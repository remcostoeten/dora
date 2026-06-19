/**
 * diffSchema — pure structural diff between two normalized SchemaIRs.
 *
 * Direction: `from` = current/live schema, `to` = desired/code schema. A
 * table/column present in `to` but not `from` is `added` (needs CREATE / ALTER
 * ADD); present in `from` but not `to` is `removed` (DROP).
 *
 * The IRs are already normalized and sorted by name, so matching is by name
 * (and for FKs by columns + refTable). The output is confidence-aware: every
 * change is tagged safe / review / destructive, and a table's confidence is the
 * worst of its children.
 */

import type {
	ColumnIR,
	ForeignKeyIR,
	IndexIR,
	NormalizedType,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'
import type {
	Change,
	ColumnDiff,
	Confidence,
	SchemaDiff,
	TableDiff,
} from './types'

const CONFIDENCE_RANK: Record<Confidence, number> = {
	safe: 0,
	review: 1,
	destructive: 2,
}

function worst(a: Confidence, b: Confidence): Confidence {
	return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b
}

function worstOf(values: Confidence[]): Confidence {
	return values.reduce<Confidence>((acc, c) => worst(acc, c), 'safe')
}

/**
 * Numeric width ordering for lossy/narrowing detection. A move to a strictly
 * smaller capacity is narrowing (destructive); a move to a larger one is a
 * widening (safe-ish, but we still flag any type change as at least review
 * because dialect coercion is not guaranteed lossless).
 */
const NUMERIC_RANK: Partial<Record<NormalizedType, number>> = {
	smallint: 1,
	int: 2,
	bigint: 3,
	float: 4,
	double: 5,
	decimal: 6,
}

function byName<T extends { name: string }>(items: T[]): Map<string, T> {
	const map = new Map<string, T>()
	for (const item of items) {
		map.set(item.name, item)
	}
	return map
}

function fkKey(fk: ForeignKeyIR): string {
	return `${fk.refTable}::${fk.columns.join(',')}`
}

function indexesEqual(a: IndexIR, b: IndexIR): boolean {
	return (
		a.unique === b.unique &&
		a.columns.length === b.columns.length &&
		a.columns.every(function compare(col, i) {
			return col === b.columns[i]
		})
	)
}

function fksEqual(a: ForeignKeyIR, b: ForeignKeyIR): boolean {
	return (
		a.refTable === b.refTable &&
		(a.onDelete ?? null) === (b.onDelete ?? null) &&
		(a.onUpdate ?? null) === (b.onUpdate ?? null) &&
		a.columns.length === b.columns.length &&
		a.columns.every(function compareCol(col, i) {
			return col === b.columns[i]
		}) &&
		a.refColumns.length === b.refColumns.length &&
		a.refColumns.every(function compareRef(col, i) {
			return col === b.refColumns[i]
		})
	)
}

/**
 * Classify a type change between two columns. Returns the confidence the change
 * contributes (only called when `type` is in changedFields, i.e. the change is
 * real — either normalized types differ, or one side is `unknown` with a
 * differing rawType).
 */
function classifyTypeChange(before: ColumnIR, after: ColumnIR): Confidence {
	// Either side unknown: we cannot reason about loss, so never confident.
	if (before.type === 'unknown' || after.type === 'unknown') {
		return 'review'
	}

	const fromRank = NUMERIC_RANK[before.type]
	const toRank = NUMERIC_RANK[after.type]

	// Narrowing within the numeric family loses data → destructive.
	if (fromRank !== undefined && toRank !== undefined) {
		return toRank < fromRank ? 'destructive' : 'review'
	}

	// Any other normalized type change (e.g. text→int, timestamp→date) is at
	// best a possibly-lossy coercion. Treat as review; the migration layer can
	// refine. (We do not claim destructive here without a known narrowing.)
	return 'review'
}

function diffColumn(before: ColumnIR | undefined, after: ColumnIR | undefined): ColumnDiff {
	if (before === undefined && after !== undefined) {
		// Added column: nullable or with default = safe; NOT NULL without
		// default = destructive (existing rows can't satisfy it).
		const isSafe = after.nullable || after.default !== null
		return {
			name: after.name,
			kind: 'added',
			after,
			confidence: isSafe ? 'safe' : 'destructive',
		}
	}

	if (before !== undefined && after === undefined) {
		// Dropping a column always risks data loss.
		return {
			name: before.name,
			kind: 'removed',
			before,
			confidence: 'destructive',
		}
	}

	// Both present → compare fields.
	const b = before as ColumnIR
	const a = after as ColumnIR
	const changedFields: Array<'type' | 'nullable' | 'default' | 'autoIncrement'> = []
	const confidences: Confidence[] = []

	// Type. Normalized equality is authoritative EXCEPT when either side is
	// unknown: never treat unknown as equal if rawTypes differ textually.
	const typesDiffer =
		b.type !== a.type ||
		((b.type === 'unknown' || a.type === 'unknown') && b.rawType !== a.rawType)
	if (typesDiffer) {
		changedFields.push('type')
		confidences.push(classifyTypeChange(b, a))
	}

	// Nullable. nullable→NOT NULL can fail on existing NULL rows → review.
	// NOT NULL→nullable is a relaxation → safe.
	if (b.nullable !== a.nullable) {
		changedFields.push('nullable')
		confidences.push(a.nullable ? 'safe' : 'review')
	}

	// Default. A pure default tweak is review (intent / existing-row ambiguity).
	if (b.default !== a.default) {
		changedFields.push('default')
		confidences.push('review')
	}

	// Auto-increment toggles are sequence/identity reshapes → review.
	if (b.autoIncrement !== a.autoIncrement) {
		changedFields.push('autoIncrement')
		confidences.push('review')
	}

	return {
		name: a.name,
		kind: 'changed',
		before: b,
		after: a,
		changedFields,
		confidence: worstOf(confidences),
	}
}

function sortColumnDiffs(diffs: ColumnDiff[]): ColumnDiff[] {
	return diffs.sort(function byColName(x, y) {
		return x.name < y.name ? -1 : x.name > y.name ? 1 : 0
	})
}

function diffColumns(from: ColumnIR[], to: ColumnIR[]): ColumnDiff[] {
	const fromMap = byName(from)
	const toMap = byName(to)
	const names = new Set<string>([...fromMap.keys(), ...toMap.keys()])
	const out: ColumnDiff[] = []

	for (const name of names) {
		const b = fromMap.get(name)
		const a = toMap.get(name)
		if (b !== undefined && a !== undefined && columnsIdentical(b, a)) {
			continue
		}
		out.push(diffColumn(b, a))
	}

	return sortColumnDiffs(out)
}

function columnsIdentical(b: ColumnIR, a: ColumnIR): boolean {
	if (b.type === 'unknown' || a.type === 'unknown') {
		// Unknown is only identical when rawTypes match textually too.
		if (b.rawType !== a.rawType) {
			return false
		}
	}
	return (
		b.type === a.type &&
		b.nullable === a.nullable &&
		b.default === a.default &&
		b.autoIncrement === a.autoIncrement
	)
}

function diffIndexes(from: IndexIR[], to: IndexIR[]): Change<IndexIR>[] {
	const fromMap = byName(from)
	const toMap = byName(to)
	const names = new Set<string>([...fromMap.keys(), ...toMap.keys()])
	const out: Change<IndexIR>[] = []

	for (const name of names) {
		const b = fromMap.get(name)
		const a = toMap.get(name)
		if (b !== undefined && a !== undefined) {
			if (!indexesEqual(b, a)) {
				out.push({ kind: 'changed', before: b, after: a })
			}
		} else if (a !== undefined) {
			out.push({ kind: 'added', after: a })
		} else if (b !== undefined) {
			out.push({ kind: 'removed', before: b })
		}
	}

	return out
}

function diffForeignKeys(from: ForeignKeyIR[], to: ForeignKeyIR[]): Change<ForeignKeyIR>[] {
	const fromMap = new Map<string, ForeignKeyIR>()
	for (const fk of from) {
		fromMap.set(fkKey(fk), fk)
	}
	const toMap = new Map<string, ForeignKeyIR>()
	for (const fk of to) {
		toMap.set(fkKey(fk), fk)
	}
	const keys = new Set<string>([...fromMap.keys(), ...toMap.keys()])
	const out: Change<ForeignKeyIR>[] = []

	for (const key of keys) {
		const b = fromMap.get(key)
		const a = toMap.get(key)
		if (b !== undefined && a !== undefined) {
			if (!fksEqual(b, a)) {
				out.push({ kind: 'changed', before: b, after: a })
			}
		} else if (a !== undefined) {
			out.push({ kind: 'added', after: a })
		} else if (b !== undefined) {
			out.push({ kind: 'removed', before: b })
		}
	}

	return out
}

/**
 * Confidence of an index change: adding is safe; removing or changing risks
 * losing a uniqueness guarantee / query path → review (dropping an index does
 * not lose row data, so not destructive).
 */
function indexConfidence(change: Change<IndexIR>): Confidence {
	return change.kind === 'added' ? 'safe' : 'review'
}

/**
 * Confidence of an FK change: adding/changing a constraint can reject existing
 * rows; removing relaxes. All are review (no row data is lost).
 */
function fkConfidence(_change: Change<ForeignKeyIR>): Confidence {
	return 'review'
}

function diffTable(before: TableIR | undefined, after: TableIR | undefined): TableDiff {
	if (before === undefined && after !== undefined) {
		// Whole table added → CREATE TABLE is safe. We still surface its columns
		// (all as 'added') for downstream rendering, but the table verdict is safe.
		const columns = sortColumnDiffs(
			after.columns.map(function asAdded(col) {
				return diffColumn(undefined, col)
			}),
		)
		const indexes: Change<IndexIR>[] = after.indexes.map(function asAdded(idx) {
			return { kind: 'added', after: idx }
		})
		const foreignKeys: Change<ForeignKeyIR>[] = after.foreignKeys.map(function asAdded(fk) {
			return { kind: 'added', after: fk }
		})
		return {
			name: after.name,
			kind: 'added',
			columns,
			indexes,
			foreignKeys,
			confidence: 'safe',
		}
	}

	if (before !== undefined && after === undefined) {
		// Whole table dropped → destructive regardless of children.
		const columns = sortColumnDiffs(
			before.columns.map(function asRemoved(col) {
				return diffColumn(col, undefined)
			}),
		)
		const indexes: Change<IndexIR>[] = before.indexes.map(function asRemoved(idx) {
			return { kind: 'removed', before: idx }
		})
		const foreignKeys: Change<ForeignKeyIR>[] = before.foreignKeys.map(function asRemoved(fk) {
			return { kind: 'removed', before: fk }
		})
		return {
			name: before.name,
			kind: 'removed',
			columns,
			indexes,
			foreignKeys,
			confidence: 'destructive',
		}
	}

	const b = before as TableIR
	const a = after as TableIR
	const columns = diffColumns(b.columns, a.columns)
	const indexes = diffIndexes(b.indexes, a.indexes)
	const foreignKeys = diffForeignKeys(b.foreignKeys, a.foreignKeys)

	const confidences: Confidence[] = [
		...columns.map(function pick(c) {
			return c.confidence
		}),
		...indexes.map(indexConfidence),
		...foreignKeys.map(fkConfidence),
	]

	return {
		name: a.name,
		kind: 'changed',
		columns,
		indexes,
		foreignKeys,
		confidence: worstOf(confidences),
	}
}

function tableHasChanges(diff: TableDiff): boolean {
	if (diff.kind !== 'changed') {
		return true
	}
	return diff.columns.length > 0 || diff.indexes.length > 0 || diff.foreignKeys.length > 0
}

export function diffSchema(from: SchemaIR, to: SchemaIR): SchemaDiff {
	const fromMap = byName(from.tables)
	const toMap = byName(to.tables)
	const names = new Set<string>([...fromMap.keys(), ...toMap.keys()])

	const tables: TableDiff[] = []
	for (const name of names) {
		const diff = diffTable(fromMap.get(name), toMap.get(name))
		if (tableHasChanges(diff)) {
			tables.push(diff)
		}
	}

	tables.sort(function byTableName(x, y) {
		return x.name < y.name ? -1 : x.name > y.name ? 1 : 0
	})

	return {
		tables,
		hasChanges: tables.length > 0,
	}
}

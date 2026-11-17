import {
	DESTRUCTIVE_BANNER,
	columnTarget,
	foreignKeyTarget,
	indexTarget,
	type MigrationStatement
} from '@studio/features/orm-cockpit/migration/generate-sql'
import type { ColumnIR } from '@studio/features/orm-cockpit/ir/types'
import type { Confidence, TableDiff } from '@studio/features/orm-cockpit/diff/types'

export type PlanOptions = {
	included: ReadonlySet<string>
	includeDestructive: boolean
	includeReview: boolean
	wrapped: boolean
}

export type PlanBlock = {
	key: string
	kind: 'statement' | 'comment' | 'gap'
	sql: string
	table: string | null
	target: string | null
	destructive: boolean
	review: boolean
}

export type MigrationPlan = {
	blocks: PlanBlock[]
	text: string
	statements: MigrationStatement[]
	heldBackDestructive: number
	heldBackReview: number
}

export type DiffSign = '+' | '−' | '~'

export type DiffLine = {
	key: string
	sign: DiffSign
	name: string
	before: string | null
	after: string
	meta: string | null
	target: string | null
}

const EMPTY_SQL = '-- No changes selected.'

function isDestructive(statement: MigrationStatement): boolean {
	return statement.section === 'destructive' && statement.review === null
}

function controlBlock(key: string, sql: string): PlanBlock {
	return {
		key,
		kind: 'comment',
		sql,
		table: null,
		target: null,
		destructive: false,
		review: false
	}
}

function gapBlock(key: string): PlanBlock {
	return { ...controlBlock(key, ''), kind: 'gap' }
}

/**
 * @name buildMigrationPlan
 * @description Picks the generated statements that belong to the included tables,
 * holds back destructive and review statements until they are opted into, and
 * returns both the display blocks and the exact text that is copied, so the
 * preview always shows what the user runs.
 *
 * @example
 * const plan = buildMigrationPlan(migration.statements, {
 * 	included: new Set(['users']),
 * 	includeDestructive: false,
 * 	includeReview: false,
 * 	wrapped: true
 * })
 * navigator.clipboard.writeText(plan.text)
 */
export function buildMigrationPlan(
	statements: MigrationStatement[],
	options: PlanOptions
): MigrationPlan {
	const inTables = statements.filter((s) => options.included.has(s.table))
	const heldBackDestructive = options.includeDestructive
		? 0
		: inTables.filter(isDestructive).length
	const heldBackReview = options.includeReview
		? 0
		: inTables.filter((s) => s.review !== null).length
	const chosen = inTables.filter(function (s) {
		if (s.review !== null) return options.includeReview
		if (isDestructive(s)) return options.includeDestructive
		return true
	})

	if (chosen.length === 0) {
		return {
			blocks: [],
			text: EMPTY_SQL,
			statements: [],
			heldBackDestructive,
			heldBackReview
		}
	}

	const blocks: PlanBlock[] = []
	if (options.wrapped) {
		blocks.push(controlBlock('begin', 'BEGIN;'))
	}
	let group = ''
	chosen.forEach(function (s, index) {
		const nextGroup = s.review !== null ? 'review' : isDestructive(s) ? 'destructive' : 'safe'
		if (nextGroup !== group) {
			if (blocks.length > 0) blocks.push(gapBlock(`gap:${index}`))
			if (nextGroup === 'destructive') {
				blocks.push(controlBlock(`banner:${index}`, DESTRUCTIVE_BANNER))
			}
			group = nextGroup
		}
		const sql = s.review !== null ? `-- REVIEW: ${s.review}\n${s.sql}` : s.sql
		blocks.push({
			key: `${s.table}:${s.target ?? ''}:${index}`,
			kind: 'statement',
			sql,
			table: s.table,
			target: s.target,
			destructive: isDestructive(s),
			review: s.review !== null
		})
	})
	if (options.wrapped) {
		blocks.push(gapBlock('gap:end'))
		blocks.push(controlBlock('commit', 'COMMIT;'))
	}

	return {
		blocks,
		text: blocks.map((b) => b.sql).join('\n'),
		statements: chosen,
		heldBackDestructive,
		heldBackReview
	}
}

/**
 * @name statementMatchesRef
 * @description Whether a generated statement belongs to a diff row. A row without a
 * target stands for the whole table and matches every statement of that table.
 *
 * @example
 * statementMatchesRef({ table: 'users', target: 'column:email' }, { table: 'users', target: null }) // true
 */
export function statementMatchesRef(
	statement: { table: string | null; target: string | null },
	ref: { table: string; target: string | null } | null
): boolean {
	if (!ref || statement.table !== ref.table) return false
	return ref.target === null || statement.target === ref.target
}

function columnType(col: ColumnIR): string {
	if (col.type === 'unknown') return col.rawType
	return col.typeParams ? `${col.type}(${col.typeParams})` : col.type
}

function columnMeta(col: ColumnIR): string {
	const bits = [col.nullable ? 'nullable' : 'not null']
	if (col.default !== null) bits.push(`default ${col.default}`)
	if (col.autoIncrement) bits.push('auto-increment')
	return bits.join(' · ')
}

function changeMeta(before: ColumnIR, after: ColumnIR, fields: string[]): string | null {
	const bits: string[] = []
	if (fields.includes('nullable')) {
		bits.push(after.nullable ? 'becomes nullable' : 'becomes not null')
	}
	if (fields.includes('default')) {
		bits.push(`default ${before.default ?? 'none'} → ${after.default ?? 'none'}`)
	}
	if (fields.includes('autoIncrement')) {
		bits.push(after.autoIncrement ? 'adds auto-increment' : 'drops auto-increment')
	}
	return bits.length > 0 ? bits.join(' · ') : null
}

function signFor(kind: TableDiff['kind']): DiffSign {
	if (kind === 'added') return '+'
	if (kind === 'removed') return '−'
	return '~'
}

/**
 * @name tableDiffLines
 * @description Flattens a table diff into the calm `+ / − / ~` lines the cockpit
 * lists, each carrying the statement target it links to. Whole-table creates and
 * drops link every line to the table itself, since they compile to one statement.
 *
 * @example
 * tableDiffLines(table).map((line) => `${line.sign} ${line.name}`)
 */
export function tableDiffLines(table: TableDiff): DiffLine[] {
	const wholeTable = table.kind !== 'changed'
	const lines: DiffLine[] = table.columns.map(function (col): DiffLine {
		const target = wholeTable ? null : columnTarget(col.name)
		if (col.kind === 'changed' && col.before && col.after) {
			const typeChanged = (col.changedFields ?? []).includes('type')
			return {
				key: `col:${col.name}`,
				sign: '~',
				name: col.name,
				before: typeChanged ? columnType(col.before) : null,
				after: columnType(col.after),
				meta: changeMeta(col.before, col.after, col.changedFields ?? []),
				target
			}
		}
		const ref = col.after ?? col.before
		return {
			key: `col:${col.name}`,
			sign: signFor(col.kind),
			name: col.name,
			before: null,
			after: ref ? columnType(ref) : '',
			meta: ref ? columnMeta(ref) : null,
			target
		}
	})
	table.indexes.forEach(function (change, i) {
		const idx = change.after ?? change.before
		lines.push({
			key: `idx:${i}`,
			sign: signFor(change.kind),
			name: idx?.name ?? 'index',
			before: null,
			after: `${idx?.unique ? 'unique index' : 'index'} (${(idx?.columns ?? []).join(', ')})`,
			meta: null,
			target: wholeTable ? null : indexTarget(change)
		})
	})
	table.foreignKeys.forEach(function (change, i) {
		const fk = change.after ?? change.before
		lines.push({
			key: `fk:${i}`,
			sign: signFor(change.kind),
			name: (fk?.columns ?? []).join(', '),
			before: null,
			after: `→ ${fk?.refTable ?? ''}(${(fk?.refColumns ?? []).join(', ')})`,
			meta: fk?.onDelete ? `on delete ${fk.onDelete}` : null,
			target: wholeTable ? null : foreignKeyTarget(change)
		})
	})
	return lines
}

/**
 * @name tableNote
 * @description One plain sentence on what reconciling a table does and where its
 * risk comes from, derived from the diff only.
 *
 * @example
 * tableNote(table) // 'Drops legacy_ref and its values.'
 */
export function tableNote(table: TableDiff): string {
	if (table.kind === 'removed') {
		return 'Not defined in your code. Dropping it deletes the table and every row in it; add it to your schema instead to keep it.'
	}
	if (table.kind === 'added') {
		const refs = Array.from(
			new Set(table.foreignKeys.map((c) => (c.after ?? c.before)?.refTable ?? ''))
		).filter(Boolean)
		return refs.length > 0
			? `New table with foreign keys to ${refs.join(', ')}. Nothing existing is touched.`
			: 'New table. Nothing existing is touched.'
	}
	const dropped = table.columns.filter((c) => c.kind === 'removed').map((c) => c.name)
	const strictAdds = table.columns
		.filter((c) => c.kind === 'added' && c.confidence === 'destructive')
		.map((c) => c.name)
	const lossy = table.columns
		.filter((c) => c.kind === 'changed' && c.confidence === 'destructive')
		.map((c) => c.name)
	const review = table.columns.filter((c) => c.confidence === 'review').map((c) => c.name)
	const droppedIndexes = table.indexes.filter((c) => c.kind === 'removed').length
	const droppedKeys = table.foreignKeys.filter((c) => c.kind === 'removed').length
	const parts: string[] = []
	if (dropped.length > 0) {
		parts.push(
			`Drops ${dropped.join(', ')} and ${dropped.length === 1 ? 'its' : 'their'} values.`
		)
	}
	if (strictAdds.length > 0) {
		parts.push(
			`Adds ${strictAdds.join(', ')} as NOT NULL without a default, which fails while the table has rows.`
		)
	}
	if (lossy.length > 0) parts.push(`Changing ${lossy.join(', ')} can lose or reject data.`)
	if (review.length > 0) {
		parts.push(`Check ${review.join(', ')} before running, the change may need a cast.`)
	}
	if (droppedIndexes + droppedKeys > 0) {
		const removed: string[] = []
		if (droppedIndexes > 0)
			removed.push(droppedIndexes === 1 ? '1 index' : `${droppedIndexes} indexes`)
		if (droppedKeys > 0)
			removed.push(droppedKeys === 1 ? '1 foreign key' : `${droppedKeys} foreign keys`)
		parts.push(
			`Removes ${removed.join(' and ')} that your code no longer defines; rows stay, but lookups or integrity checks change.`
		)
	}
	if (parts.length === 0) return 'Additive only, existing rows keep working.'
	return parts.join(' ')
}

/**
 * @name riskLabel
 * @description Display label for a confidence level.
 *
 * @example
 * riskLabel('destructive') // 'Destructive'
 */
export function riskLabel(risk: Confidence): string {
	return risk.charAt(0).toUpperCase() + risk.slice(1)
}

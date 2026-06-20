import type {
	ColumnInfo,
	DatabaseSchema,
	IndexInfo,
	TableInfo,
} from '@studio/lib/bindings'
import { normalizeDbType } from '@studio/features/orm-cockpit/ir/normalize-type'
import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'

/**
 * Map the live database's {@link DatabaseSchema} (as it crosses the Rust→TS
 * boundary via bindings) into the normalized {@link SchemaIR}.
 *
 * Note the bindings use snake_case (`data_type`, `is_nullable`,
 * `primary_key_columns`, …) and several fields are optional — we read them
 * defensively. Collections are sorted by name so the result diffs
 * deterministically against an IR produced from a schema file.
 */
export function fromLiveSchema(schema: DatabaseSchema, dialect: Dialect): SchemaIR {
	const tables = schema.tables
		.map(function (table) {
			return mapTable(table, dialect)
		})
		.sort(byName)

	return { dialect, tables }
}

function mapTable(table: TableInfo, dialect: Dialect): TableIR {
	const columns = table.columns.map(function (column) {
		return mapColumn(column, dialect)
	})

	const primaryKey = derivePrimaryKey(table)
	const hasExplicitPk = primaryKey.length > 0

	const indexes = (table.indexes ?? [])
		// The PK is already represented by `primaryKey`; drop its implicit index
		// so it isn't double-counted as drift.
		.filter(function (index) {
			return !(index.is_primary && hasExplicitPk)
		})
		.map(mapIndex)
		.sort(byName)

	const ir: TableIR = {
		name: table.name,
		columns: columns.sort(byName),
		primaryKey,
		indexes,
		foreignKeys: collectForeignKeys(table.columns),
	}

	// Preserve a meaningful schema; SQLite reports none.
	if (table.schema && table.schema.length > 0) {
		ir.schema = table.schema
	}

	return ir
}

function mapColumn(column: ColumnInfo, dialect: Dialect): ColumnIR {
	return {
		name: column.name,
		type: normalizeDbType(column.data_type, dialect),
		rawType: column.data_type,
		nullable: column.is_nullable,
		default: normalizeDefault(column.default_value),
		autoIncrement: column.is_auto_increment ?? false,
	}
}

function mapIndex(index: IndexInfo): IndexIR {
	return {
		name: index.name,
		columns: index.column_names,
		unique: index.is_unique,
	}
}

/**
 * Prefer the authoritative ordered `primary_key_columns`; fall back to the
 * per-column `is_primary_key` flags (in column order) for adapters that don't
 * populate it.
 */
function derivePrimaryKey(table: TableInfo): string[] {
	if (table.primary_key_columns && table.primary_key_columns.length > 0) {
		return table.primary_key_columns
	}
	return table.columns
		.filter(function (column) {
			return column.is_primary_key === true
		})
		.map(function (column) {
			return column.name
		})
}

/**
 * The live schema carries foreign keys per column, so fold them into
 * {@link ForeignKeyIR} grouped by referenced table/schema (composite FKs
 * surface as multiple per-column entries pointing at the same table). Result
 * is sorted for deterministic diffs.
 */
function collectForeignKeys(columns: ColumnInfo[]): ForeignKeyIR[] {
	const byRef = new Map<string, ForeignKeyIR>()

	for (const column of columns) {
		const fk = column.foreign_key
		if (!fk) {
			continue
		}

		const key = `${fk.referenced_schema}.${fk.referenced_table}`
		const existing = byRef.get(key)
		if (existing) {
			existing.columns.push(column.name)
			existing.refColumns.push(fk.referenced_column)
		} else {
			byRef.set(key, {
				columns: [column.name],
				refTable: fk.referenced_table,
				refColumns: [fk.referenced_column],
			})
		}
	}

	return Array.from(byRef.values()).sort(function (a, b) {
		const table = a.refTable.localeCompare(b.refTable)
		if (table !== 0) {
			return table
		}
		return a.columns.join(',').localeCompare(b.columns.join(','))
	})
}

/** Empty/whitespace-only defaults become null; otherwise keep the raw text.
 * Deeper default normalization (e.g. `now()` vs `CURRENT_TIMESTAMP`) is left to
 * the diff engine, which compares conservatively. */
function normalizeDefault(value: string | null): string | null {
	if (value === null) {
		return null
	}
	const trimmed = value.trim()
	return trimmed.length === 0 ? null : trimmed
}

function byName(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name)
}

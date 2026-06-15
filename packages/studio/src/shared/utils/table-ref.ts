type TableRefLike = {
	name: string
	schema?: string | null
}

export type TableDialect = 'postgres' | 'cockroach' | 'mysql' | 'mariadb' | 'sqlite' | 'duckdb' | 'libsql'

export type TableRefParts = {
	schemaName: string | null
	tableName: string
}

function dialectUsesSchemas(dialect?: TableDialect): boolean {
	return (
		dialect === 'postgres' ||
		dialect === 'cockroach' ||
		dialect === 'mysql' ||
		dialect === 'mariadb' ||
		dialect === 'duckdb'
	)
}

export function getTableRefParts(value: string): TableRefParts {
	const separatorIndex = value.indexOf('.')
	if (separatorIndex === -1) {
		return {
			schemaName: null,
			tableName: value
		}
	}

	return {
		schemaName: value.slice(0, separatorIndex) || null,
		tableName: value.slice(separatorIndex + 1)
	}
}

export function getTableRefId(table: TableRefLike): string {
	if (table.schema) {
		return `${table.schema}.${table.name}`
	}

	return table.name
}

export function getTableSqlIdentifier(
	table: string | TableRefLike,
	dialect?: TableDialect
): string {
	const parts =
		typeof table === 'string'
			? getTableRefParts(table)
			: {
					schemaName: table.schema ?? null,
					tableName: table.name
				}

	if (dialect === 'mysql' || dialect === 'mariadb') {
		if (parts.schemaName) {
			return `\`${parts.schemaName}\`.\`${parts.tableName}\``
		}

		return `\`${parts.tableName}\``
	}

	if (
		parts.schemaName &&
		(dialect === undefined || dialectUsesSchemas(dialect))
	) {
		return `"${parts.schemaName}"."${parts.tableName}"`
	}

	return `"${parts.tableName}"`
}

// Quotes a bare column name for the given dialect. MySQL/MariaDB use backticks,
// everything else (and the unknown/default case) uses ANSI double quotes. An
// already-quoted identifier (starts with the dialect's quote char) is returned
// unchanged so callers can pass through user-supplied quoting.
export function getColumnSqlIdentifier(column: string, dialect?: TableDialect): string {
	const trimmed = column.trim()
	if (dialect === 'mysql' || dialect === 'mariadb') {
		if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
			return trimmed
		}
		return `\`${trimmed}\``
	}

	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed
	}
	return `"${trimmed}"`
}

// Builds the `ALTER TABLE ... DROP COLUMN` statement for the given dialect.
//
// All dialects Dora supports run an engine new enough for native DROP COLUMN:
//   - Postgres / Cockroach: `ALTER TABLE t DROP COLUMN "c"`
//   - MySQL / MariaDB:       `ALTER TABLE t DROP COLUMN \`c\``
//   - SQLite / LibSQL:       native since SQLite 3.35 (2021); the bundled
//     `libsql-rusqlite` / `libsql` engines are well past that.
//
// `IF EXISTS` on the column is intentionally NOT emitted: Postgres supports it
// but MySQL/SQLite do not, so a missing column surfaces as a clear error rather
// than a silent no-op. The destructive confirm happens in the UI dialog.
export function buildDropColumnSql(
	table: string,
	column: string,
	dialect?: TableDialect
): string {
	const tableId = getTableSqlIdentifier(table, dialect)
	const columnId = getColumnSqlIdentifier(column, dialect)
	return `ALTER TABLE ${tableId} DROP COLUMN ${columnId}`
}

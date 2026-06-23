import type { DatabaseSchema, TableInfo, ColumnInfo } from '@studio/lib/bindings'
import { tableToModelName, tableToModelKey } from './model-mapper'

export type PrismaProvider = 'postgresql' | 'mysql' | 'sqlite'

/**
 * Maps a SQL `data_type` to the closest Prisma scalar type. Order matters:
 * more specific patterns (bigint, serial) are tested before broader ones.
 */
function prismaScalarType(dataType: string): string {
	const type = dataType.toLowerCase()
	if (/bigint|int8|bigserial/.test(type)) return 'BigInt'
	if (/serial|int|smallint|tinyint|mediumint|year/.test(type)) return 'Int'
	if (/bool/.test(type)) return 'Boolean'
	if (/timestamp|datetime|date|time/.test(type)) return 'DateTime'
	if (/decimal|numeric|money/.test(type)) return 'Decimal'
	if (/double|float|real/.test(type)) return 'Float'
	if (/json/.test(type)) return 'Json'
	if (/bytea|blob|binary/.test(type)) return 'Bytes'
	return 'String'
}

function prismaDefault(column: ColumnInfo): string | null {
	if (column.is_auto_increment) return '@default(autoincrement())'
	const raw = column.default_value
	if (raw == null) return null
	const lowered = raw.toLowerCase().trim()
	if (/current_timestamp|now\(\)|getdate\(\)/.test(lowered)) return '@default(now())'
	if (/gen_random_uuid|uuid\(\)/.test(lowered)) return '@default(uuid())'
	if (lowered === 'true' || lowered === 'false') return `@default(${lowered})`
	if (lowered === 'null') return null
	if (/^-?\d+(?:\.\d+)?$/.test(lowered)) return `@default(${raw.trim()})`
	const unquoted = raw.replace(/^['"]|['"]$/g, '')
	return `@default("${unquoted}")`
}

function primaryKeyColumns(table: TableInfo): string[] {
	if (table.primary_key_columns && table.primary_key_columns.length > 0) {
		return table.primary_key_columns
	}
	return table.columns.filter((column) => column.is_primary_key).map((column) => column.name)
}

function uniqueSingleColumns(schema: DatabaseSchema, table: TableInfo): Set<string> {
	const unique = new Set<string>()
	for (const index of table.indexes ?? []) {
		if (index.is_unique && !index.is_primary && index.column_names.length === 1) {
			unique.add(index.column_names[0])
		}
	}
	for (const entry of schema.unique_columns ?? []) {
		if (entry.includes('.')) {
			const [tableName, columnName] = entry.split('.')
			if (tableName === table.name) unique.add(columnName)
		}
	}
	return unique
}

function compositeUniqueIndexes(table: TableInfo): string[][] {
	return (table.indexes ?? [])
		.filter((index) => index.is_unique && !index.is_primary && index.column_names.length > 1)
		.map((index) => index.column_names)
}

function fieldLine(
	schema: DatabaseSchema,
	table: TableInfo,
	column: ColumnInfo,
	pkColumns: string[],
	uniqueColumns: Set<string>
): string {
	const isPrimary = pkColumns.includes(column.name)
	const optional = column.is_nullable && !isPrimary ? '?' : ''
	const attributes: string[] = []

	if (isPrimary && pkColumns.length === 1) attributes.push('@id')
	if (uniqueColumns.has(column.name) && !isPrimary) attributes.push('@unique')

	const def = prismaDefault(column)
	if (def) attributes.push(def)

	const suffix = attributes.length > 0 ? `  ${attributes.join(' ')}` : ''
	return `  ${column.name} ${prismaScalarType(column.data_type)}${optional}${suffix}`
}

function relationLine(column: ColumnInfo): string | null {
	const fk = column.foreign_key
	if (!fk) return null
	const relationField = tableToModelKey(fk.referenced_table)
	const relatedModel = tableToModelName(fk.referenced_table)
	const optional = column.is_nullable ? '?' : ''
	return `  ${relationField} ${relatedModel}${optional} @relation(fields: [${column.name}], references: [${fk.referenced_column}])`
}

function modelBlock(schema: DatabaseSchema, table: TableInfo): string {
	const modelName = tableToModelName(table.name)
	const pkColumns = primaryKeyColumns(table)
	const uniqueColumns = uniqueSingleColumns(schema, table)

	const lines: string[] = [`model ${modelName} {`]

	for (const column of table.columns) {
		lines.push(fieldLine(schema, table, column, pkColumns, uniqueColumns))
		const relation = relationLine(column)
		if (relation) lines.push(relation)
	}

	const blockAttributes: string[] = []
	if (pkColumns.length > 1) blockAttributes.push(`  @@id([${pkColumns.join(', ')}])`)
	for (const columns of compositeUniqueIndexes(table)) {
		blockAttributes.push(`  @@unique([${columns.join(', ')}])`)
	}
	if (modelName !== table.name) blockAttributes.push(`  @@map("${table.name}")`)

	if (blockAttributes.length > 0) {
		lines.push('')
		lines.push(...blockAttributes)
	}

	lines.push('}')
	return lines.join('\n')
}

/**
 * Renders a live `DatabaseSchema` as a formatted `schema.prisma` string —
 * datasource + generator header followed by one `model` block per table,
 * with scalar fields, `@id`/`@unique`/`@default`, relation fields for foreign
 * keys, and `@@id`/`@@unique`/`@@map` model attributes where relevant.
 */
export function databaseSchemaToPrisma(
	schema: DatabaseSchema,
	provider: PrismaProvider = 'postgresql'
): string {
	const header = [
		'datasource db {',
		`  provider = "${provider}"`,
		'  url      = env("DATABASE_URL")',
		'}',
		'',
		'generator client {',
		'  provider = "prisma-client-js"',
		'}'
	].join('\n')

	if (schema.tables.length === 0) {
		return `${header}\n\n// No tables found in the current schema.`
	}

	const models = schema.tables.map((table) => modelBlock(schema, table))
	return `${header}\n\n${models.join('\n\n')}\n`
}

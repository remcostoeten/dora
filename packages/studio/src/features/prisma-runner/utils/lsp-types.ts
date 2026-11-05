import type { ColumnInfo, DatabaseSchema, TableInfo } from '@studio/lib/bindings'
import { tableToModelKey, tableToModelName, type ModelMap } from './model-mapper'

/**
 * Generates ambient TypeScript declarations for the Monaco editor so the
 * built-in TS engine can validate and complete Prisma Client queries against
 * the live database schema.
 */
export function generatePrismaTypes(schema: DatabaseSchema, modelMap: ModelMap): string {
	const tablesByName = new Map<string, TableInfo>()
	for (const table of schema.tables) {
		tablesByName.set(table.name, table)
	}

	const orderedModelKeys = Object.keys(modelMap)
	const entries = orderedModelKeys
		.map(function (modelKey) {
			const tableName = modelMap[modelKey]
			const table = tablesByName.get(tableName)
			if (!table) return null
			return { modelKey, table, modelName: tableToModelName(table.name) }
		})
		.filter(function (entry): entry is {
			modelKey: string
			table: TableInfo
			modelName: string
		} {
			return entry !== null
		})

	const interfaceDefs = entries
		.map(function (entry) {
			return buildModelInterfaces(entry.modelName, entry.table)
		})
		.join('\n\n')

	const delegateProps = entries
		.map(function (entry) {
			return `    ${propertyKey(entry.modelKey)}: ${entry.modelName}Delegate;`
		})
		.join('\n')

	return `/**
 * PRISMA CLIENT VIRTUAL TYPE DEFINITIONS
 * Generated for Monaco Editor
 */

type PrismaStringFilter = { equals?: string; not?: string; in?: string[]; notIn?: string[]; lt?: string; lte?: string; gt?: string; gte?: string; contains?: string; startsWith?: string; endsWith?: string };
type PrismaNumberFilter = { equals?: number; not?: number; in?: number[]; notIn?: number[]; lt?: number; lte?: number; gt?: number; gte?: number };
type PrismaBooleanFilter = { equals?: boolean; not?: boolean };
type PrismaDateFilter = { equals?: Date | string; not?: Date | string; in?: (Date | string)[]; notIn?: (Date | string)[]; lt?: Date | string; lte?: Date | string; gt?: Date | string; gte?: Date | string };
type PrismaUnknownFilter = { equals?: unknown; not?: unknown; in?: unknown[]; notIn?: unknown[] };

${interfaceDefs}

declare const prisma: {
${delegateProps}
    $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
};
`
}

function buildModelInterfaces(modelName: string, table: TableInfo): string {
	const whereFields = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}?: ${columnFieldType(column)};`
		})
		.join('\n')

	const selectFields = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}?: boolean;`
		})
		.join('\n')

	const includeFields = table.columns
		.filter(function (column) {
			return Boolean(column.foreign_key)
		})
		.map(function (column) {
			const relationKey = column.foreign_key
				? tableToModelKey(column.foreign_key.referenced_table)
				: tableToModelKey(stripIdSuffix(column.name))
			return `    ${propertyKey(relationKey)}?: boolean;`
		})
		.join('\n')

	const orderByFields = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}?: 'asc' | 'desc';`
		})
		.join('\n')

	const dataFields = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}?: ${columnTsType(column)};`
		})
		.join('\n')

	const whereInput = `interface ${modelName}WhereInput {
${whereFields}
    AND?: ${modelName}WhereInput | ${modelName}WhereInput[];
    OR?: ${modelName}WhereInput[];
    NOT?: ${modelName}WhereInput | ${modelName}WhereInput[];
}`

	const selectInput = `interface ${modelName}SelectInput {
${selectFields || '    [key: string]: boolean | undefined;'}
}`

	const includeInput = `interface ${modelName}IncludeInput {
${includeFields || '    [key: string]: boolean | undefined;'}
}`

	const orderByInput = `interface ${modelName}OrderByInput {
${orderByFields}
}`

	const dataInput = `interface ${modelName}DataInput {
${dataFields}
}`

	const findManyArgs = `{ where?: ${modelName}WhereInput; select?: ${modelName}SelectInput; include?: ${modelName}IncludeInput; orderBy?: ${modelName}OrderByInput | ${modelName}OrderByInput[]; take?: number; skip?: number; distinct?: string | string[]; cursor?: ${modelName}WhereInput }`
	const findUniqueArgs = `{ where: ${modelName}WhereInput; select?: ${modelName}SelectInput; include?: ${modelName}IncludeInput }`
	const findFirstArgs = `{ where?: ${modelName}WhereInput; select?: ${modelName}SelectInput; include?: ${modelName}IncludeInput; orderBy?: ${modelName}OrderByInput | ${modelName}OrderByInput[] }`

	const delegate = `interface ${modelName}Delegate {
    findMany(args?: ${findManyArgs}): Promise<unknown[]>;
    findFirst(args?: ${findFirstArgs}): Promise<unknown | null>;
    findUnique(args: ${findUniqueArgs}): Promise<unknown | null>;
    create(args: { data: ${modelName}DataInput; select?: ${modelName}SelectInput; include?: ${modelName}IncludeInput }): Promise<unknown>;
    createMany(args: { data: ${modelName}DataInput[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
    update(args: { where: ${modelName}WhereInput; data: ${modelName}DataInput; select?: ${modelName}SelectInput }): Promise<unknown>;
    updateMany(args: { where?: ${modelName}WhereInput; data: ${modelName}DataInput }): Promise<{ count: number }>;
    delete(args: { where: ${modelName}WhereInput; select?: ${modelName}SelectInput }): Promise<unknown>;
    deleteMany(args?: { where?: ${modelName}WhereInput }): Promise<{ count: number }>;
    count(args?: { where?: ${modelName}WhereInput }): Promise<number>;
}`

	return [whereInput, selectInput, includeInput, orderByInput, dataInput, delegate].join('\n\n')
}

function columnFieldType(column: ColumnInfo): string {
	const base = baseColumnTsType(column.data_type)
	const filter = filterTypeFor(base)
	return `${base} | ${filter}`
}

function filterTypeFor(base: string): string {
	if (base === 'string') return 'PrismaStringFilter'
	if (base === 'number') return 'PrismaNumberFilter'
	if (base === 'boolean') return 'PrismaBooleanFilter'
	if (base === 'Date | string') return 'PrismaDateFilter'
	return 'PrismaUnknownFilter'
}

function columnTsType(column: ColumnInfo): string {
	const base = baseColumnTsType(column.data_type)
	if (column.is_nullable) {
		return `${base} | null`
	}
	return base
}

function baseColumnTsType(dataType: string): string {
	const normalized = dataType.toLowerCase()
	if (
		/\b(bigint|int8|integer|int|int2|int4|serial|smallint|smallserial|bigserial)\b/.test(
			normalized
		)
	) {
		return 'number'
	}
	if (/\b(float|float4|float8|double|real|numeric|decimal|money)\b/.test(normalized)) {
		return 'number'
	}
	if (/\b(boolean|bool)\b/.test(normalized)) {
		return 'boolean'
	}
	if (/\b(timestamptz|timestamp|datetime|date|time)\b/.test(normalized)) {
		return 'Date | string'
	}
	if (/\b(json|jsonb)\b/.test(normalized)) {
		return 'unknown'
	}
	if (/\b(bytea|blob)\b/.test(normalized)) {
		return 'string'
	}
	if (normalized.includes('char') || /\b(text|uuid|enum)\b/.test(normalized)) {
		return 'string'
	}
	return 'unknown'
}

function stripIdSuffix(columnName: string): string {
	return columnName.replace(/_?id$/i, '')
}

function propertyKey(value: string): string {
	if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
		return value
	}
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

import { SchemaColumn, SchemaTable } from '../types'

/**
 * Generates ambient TypeScript declarations for the Monaco editor.
 *
 * The declarations intentionally model the parts of Drizzle users tend to type
 * in the runner rather than trying to mirror Drizzle's full internal type graph.
 */
export function generateDrizzleTypes(tables: SchemaTable[]): string {
	const tableEntries = tables.map(function (table, index) {
		return createTableEntry(table, index)
	})
	const tableDefs = tableEntries
		.map(function (entry) {
			return entry.definition
		})
		.join('\n\n')
	const globalTableDecls = tableEntries
		.filter(function (entry) {
			return entry.globalIdentifier !== null
		})
		.map(function (entry) {
			return `declare const ${entry.globalIdentifier}: ${entry.tableTypeName};`
		})
		.join('\n')
	const schemaProperties = tableEntries
		.map(function (entry) {
			return `    ${propertyKey(entry.table.name)}: ${entry.tableTypeName};`
		})
		.join('\n')
	const moduleSchemaProperties = tableEntries
		.map(function (entry) {
			return `        ${propertyKey(entry.table.name)}: ${entry.tableTypeName};`
		})
		.join('\n')
	const queryProperties = tableEntries
		.map(function (entry) {
			return `    ${propertyKey(entry.table.name)}: RelationalQuery<${entry.rowTypeName}, ${entry.columnsTypeName}>;`
		})
		.join('\n')
	const moduleExports = tableEntries
		.map(function (entry) {
			return `    export const ${entry.exportIdentifier}: ${entry.tableTypeName};`
		})
		.join('\n')

	return `
/**
 * DRIZZLE ORM VIRTUAL TYPE DEFINITIONS
 * Generated for Monaco Editor
 */

type DrizzleValue = string | number | boolean | Date | bigint | Uint8Array | null;
type DirectWhereOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'like' | 'ilike';

interface Column<TData, TName extends string = string> {
    readonly _brand: 'Column';
    readonly name: TName;
    readonly dataType: TData;
    readonly _type: TData;
}

type AnyColumn = Column<unknown, string>;

interface SQL<TData = unknown> {
    readonly _brand: 'SQL';
    readonly _type: TData;
}

type SelectedValue<T> = T extends Column<infer TValue, string>
    ? TValue
    : T extends SQL<infer TValue>
      ? TValue
      : T extends Table<string, unknown, infer TRow>
        ? TRow
        : never;

type SelectedFields<TSelection> = {
    [K in keyof TSelection]: SelectedValue<TSelection[K]>;
};

type InferModelFromColumns<TColumns> = {
    [K in keyof TColumns]: TColumns[K] extends Column<infer TValue, string> ? TValue : never;
};

type InferInsertModel<TColumns> = {
    [K in keyof TColumns]?: TColumns[K] extends Column<infer TValue, string> ? TValue : never;
};

type Table<TName extends string, TColumns, TRow> = TColumns & {
    readonly _brand: 'Table';
    readonly _: {
        readonly name: TName;
        readonly columns: TColumns;
        readonly inferSelect: TRow;
        readonly inferInsert: InferInsertModel<TColumns>;
    };
};

type AnyTable = Table<string, unknown, unknown>;

${tableDefs}

${globalTableDecls}

declare const schema: {
${schemaProperties}
};

interface QueryObject {
${queryProperties}
}

interface QueryOperators {
    eq: typeof eq;
    ne: typeof ne;
    gt: typeof gt;
    lt: typeof lt;
    gte: typeof gte;
    lte: typeof lte;
    like: typeof like;
    ilike: typeof ilike;
    inArray: typeof inArray;
    notInArray: typeof notInArray;
    isNull: typeof isNull;
    isNotNull: typeof isNotNull;
    and: typeof and;
    or: typeof or;
    not: typeof not;
    asc: typeof asc;
    desc: typeof desc;
}

interface QueryFindManyOptions<TRow, TColumns> {
    where?: SQL<boolean> | ((table: TColumns, operators: QueryOperators) => SQL<boolean> | undefined);
    orderBy?: SQL<unknown> | SQL<unknown>[] | ((table: TColumns, operators: QueryOperators) => SQL<unknown> | SQL<unknown>[]);
    columns?: Partial<Record<keyof TRow, boolean>>;
    extras?: Record<string, SQL<unknown>>;
    with?: Record<string, unknown>;
    limit?: number;
    offset?: number;
}

type QueryFindFirstOptions<TRow, TColumns> = Omit<QueryFindManyOptions<TRow, TColumns>, 'limit'>;

interface RelationalQuery<TRow, TColumns> {
    findMany(options?: QueryFindManyOptions<TRow, TColumns>): Promise<TRow[]>;
    findFirst(options?: QueryFindFirstOptions<TRow, TColumns>): Promise<TRow | undefined>;
}

interface QueryBuilder<TResult> {
    where(condition: SQL<boolean> | undefined): QueryBuilder<TResult>;
    where(column: string, operator: DirectWhereOperator, value: DrizzleValue): QueryBuilder<TResult>;
    orderBy(...columns: (AnyColumn | SQL<unknown>)[]): QueryBuilder<TResult>;
    groupBy(...columns: AnyColumn[]): QueryBuilder<TResult>;
    limit(limit: number): QueryBuilder<TResult>;
    offset(offset: number): QueryBuilder<TResult>;
    update(values: Record<string, DrizzleValue>): {
        where(column: string, operator: DirectWhereOperator, value: DrizzleValue): {
            returning(): Promise<unknown[]>;
            execute(): Promise<void>;
        };
        returning(): Promise<unknown[]>;
        execute(): Promise<void>;
    };
    leftJoin<TRight extends AnyTable>(table: TRight, condition: SQL<boolean>): QueryBuilder<TResult>;
    innerJoin<TRight extends AnyTable>(table: TRight, condition: SQL<boolean>): QueryBuilder<TResult>;
    rightJoin<TRight extends AnyTable>(table: TRight, condition: SQL<boolean>): QueryBuilder<TResult>;
    fullJoin<TRight extends AnyTable>(table: TRight, condition: SQL<boolean>): QueryBuilder<TResult>;
    execute(): Promise<TResult[]>;
    getSQL(): SQL<TResult[]>;
}

interface SelectBuilder<TSelection = undefined> {
    from<TTable extends Table<string, unknown, unknown>>(
        table: TTable
    ): QueryBuilder<TSelection extends undefined ? TTable['_']['inferSelect'] : SelectedFields<TSelection>>;
    from(table: string): QueryBuilder<any>;
}

interface InsertBuilder<TColumns> {
    values(values: InferInsertModel<TColumns> | InferInsertModel<TColumns>[]): {
        returning(): Promise<InferModelFromColumns<TColumns>[]>;
        execute(): Promise<void>;
    };
}

interface UpdateBuilder<TColumns> {
    set(values: Partial<InferInsertModel<TColumns>>): {
        where(condition: SQL<boolean>): {
            returning(): Promise<InferModelFromColumns<TColumns>[]>;
            execute(): Promise<void>;
        };
        returning(): Promise<InferModelFromColumns<TColumns>[]>;
        execute(): Promise<void>;
    };
}

interface DeleteBuilder {
    where(condition: SQL<boolean>): {
        returning(): Promise<unknown[]>;
        execute(): Promise<void>;
    };
    returning(): Promise<unknown[]>;
    execute(): Promise<void>;
}

interface DB {
    query: QueryObject;
    select(): SelectBuilder;
    select<TSelection extends Record<string, AnyColumn | SQL<unknown> | AnyTable>>(fields: TSelection): SelectBuilder<TSelection>;
    insert<TTable extends Table<string, unknown, unknown>>(table: TTable): InsertBuilder<TTable['_']['columns']>;
    update<TTable extends Table<string, unknown, unknown>>(table: TTable): UpdateBuilder<TTable['_']['columns']>;
    delete<TTable extends Table<string, unknown, unknown>>(table: TTable): DeleteBuilder;
    execute<TResult = unknown>(query: SQL<TResult> | string): Promise<TResult[]>;
    transaction<T>(handler: (tx: Transaction) => Promise<T>): Promise<T>;
    batch<T extends readonly unknown[]>(queries: T): Promise<{ [K in keyof T]: unknown }>;
}

interface Transaction extends Omit<DB, 'transaction'> {}

declare const db: DB;

declare function eq<T>(column: Column<T>, value: T): SQL<boolean>;
declare function ne<T>(column: Column<T>, value: T): SQL<boolean>;
declare function gt<T>(column: Column<T>, value: T): SQL<boolean>;
declare function lt<T>(column: Column<T>, value: T): SQL<boolean>;
declare function gte<T>(column: Column<T>, value: T): SQL<boolean>;
declare function lte<T>(column: Column<T>, value: T): SQL<boolean>;
declare function inArray<T>(column: Column<T>, values: T[]): SQL<boolean>;
declare function notInArray<T>(column: Column<T>, values: T[]): SQL<boolean>;
declare function isNull(column: AnyColumn): SQL<boolean>;
declare function isNotNull(column: AnyColumn): SQL<boolean>;
declare function like(column: Column<string>, pattern: string): SQL<boolean>;
declare function ilike(column: Column<string>, pattern: string): SQL<boolean>;
declare function and(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
declare function or(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
declare function not(condition: SQL<boolean>): SQL<boolean>;
declare function asc(column: AnyColumn): SQL<unknown>;
declare function desc(column: AnyColumn): SQL<unknown>;
declare function count(): SQL<number>;
declare function count(column: AnyColumn): SQL<number>;
declare function countDistinct(column: AnyColumn): SQL<number>;
declare function sum(column: Column<number>): SQL<number>;
declare function sumDistinct(column: Column<number>): SQL<number>;
declare function avg(column: Column<number>): SQL<number>;
declare function min<T>(column: Column<T>): SQL<T>;
declare function max<T>(column: Column<T>): SQL<T>;
declare function arrayContains<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
declare function arrayContained<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
declare function arrayOverlaps<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
declare function sql<T = unknown>(strings: TemplateStringsArray, ...params: unknown[]): SQL<T>;
declare function param<T>(value?: T): T;

declare module 'drizzle-orm' {
    export interface SQL<TData = unknown> {
        readonly _brand: 'SQL';
        readonly _type: TData;
    }
    export function eq<T>(column: Column<T>, value: T): SQL<boolean>;
    export function ne<T>(column: Column<T>, value: T): SQL<boolean>;
    export function gt<T>(column: Column<T>, value: T): SQL<boolean>;
    export function lt<T>(column: Column<T>, value: T): SQL<boolean>;
    export function gte<T>(column: Column<T>, value: T): SQL<boolean>;
    export function lte<T>(column: Column<T>, value: T): SQL<boolean>;
    export function inArray<T>(column: Column<T>, values: T[]): SQL<boolean>;
    export function notInArray<T>(column: Column<T>, values: T[]): SQL<boolean>;
    export function isNull(column: AnyColumn): SQL<boolean>;
    export function isNotNull(column: AnyColumn): SQL<boolean>;
    export function like(column: Column<string>, pattern: string): SQL<boolean>;
    export function ilike(column: Column<string>, pattern: string): SQL<boolean>;
    export function and(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
    export function or(...conditions: (SQL<boolean> | undefined)[]): SQL<boolean>;
    export function not(condition: SQL<boolean>): SQL<boolean>;
    export function asc(column: AnyColumn): SQL<unknown>;
    export function desc(column: AnyColumn): SQL<unknown>;
    export function count(): SQL<number>;
    export function count(column: AnyColumn): SQL<number>;
    export function countDistinct(column: AnyColumn): SQL<number>;
    export function sum(column: Column<number>): SQL<number>;
    export function sumDistinct(column: Column<number>): SQL<number>;
    export function avg(column: Column<number>): SQL<number>;
    export function min<T>(column: Column<T>): SQL<T>;
    export function max<T>(column: Column<T>): SQL<T>;
    export function arrayContains<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
    export function arrayContained<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
    export function arrayOverlaps<T>(column: Column<T[]>, values: T[]): SQL<boolean>;
    export function sql<T = unknown>(strings: TemplateStringsArray, ...params: unknown[]): SQL<T>;
    export function param<T>(value?: T): T;
}

declare module 'schema' {
${moduleExports}
    export const schema: {
${moduleSchemaProperties}
    };
}

declare module '@/db/schema' {
${moduleExports}
    export const schema: {
${moduleSchemaProperties}
    };
}
`
}

function createTableEntry(table: SchemaTable, index: number) {
	const typeBase = toTypeIdentifier(table.name) || `Table${index + 1}`
	const columnsTypeName = `${typeBase}Columns`
	const rowTypeName = `${typeBase}Row`
	const insertTypeName = `${typeBase}Insert`
	const tableTypeName = `${typeBase}Table`
	const globalIdentifier = isIdentifier(table.name) ? table.name : null
	const exportIdentifier = globalIdentifier || toIdentifier(lastNameSegment(table.name)) || `table${index + 1}`
	const columnDefs = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}: Column<${columnTsType(column)}, '${escapeTypeString(column.name)}'>;`
		})
		.join('\n')
	const rowDefs = table.columns
		.map(function (column) {
			return `    ${propertyKey(column.name)}: ${columnTsType(column)};`
		})
		.join('\n')
	const definition = `/** Columns for ${table.name}. */
interface ${columnsTypeName} {
${columnDefs}
}

/** Select row model for ${table.name}. */
interface ${rowTypeName} {
${rowDefs}
}

/** Insert model for ${table.name}. */
type ${insertTypeName} = InferInsertModel<${columnsTypeName}>;

/** Table object for ${table.name}. */
type ${tableTypeName} = Table<'${escapeTypeString(table.name)}', ${columnsTypeName}, ${rowTypeName}>;`

	return {
		columnsTypeName,
		definition,
		exportIdentifier,
		globalIdentifier,
		insertTypeName,
		rowTypeName,
		table,
		tableTypeName
	}
}

function columnTsType(column: SchemaColumn): string {
	let tsType = baseColumnTsType(column.type)
	if (column.nullable) {
		tsType = `${tsType} | null`
	}
	return tsType
}

function baseColumnTsType(type: string): string {
	const normalized = type.toLowerCase()
	if (/\b(bigint|bigserial|int8)\b/.test(normalized)) {
		return 'bigint'
	}
	if (/\b(smallint|integer|int|int2|int4|serial|smallserial|float|float4|float8|double|decimal|numeric|real|money)\b/.test(normalized)) {
		return 'number'
	}
	if (/\b(boolean|bool)\b/.test(normalized)) {
		return 'boolean'
	}
	if (/\b(timestamp|timestamptz|date|datetime|time)\b/.test(normalized)) {
		return 'Date'
	}
	if (/\b(json|jsonb)\b/.test(normalized)) {
		return 'unknown'
	}
	if (/\b(bytea|blob|binary|varbinary)\b/.test(normalized)) {
		return 'Uint8Array'
	}
	if (/\b(char|varchar|text|uuid|enum|inet|cidr|macaddr|xml)\b/.test(normalized)) {
		return 'string'
	}
	return 'DrizzleValue'
}

function toTypeIdentifier(value: string): string {
	const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean)
	const identifier = parts
		.map(function (part) {
			const safe = toIdentifier(part)
			if (!safe) return ''
			return capitalize(safe)
		})
		.join('')
	return isIdentifier(identifier) ? identifier : ''
}

function toIdentifier(value: string): string {
	const identifier = value.replace(/[^A-Za-z0-9_$]/g, '_')
	if (!identifier) return ''
	if (/^[0-9]/.test(identifier)) {
		return `_${identifier}`
	}
	return isIdentifier(identifier) ? identifier : ''
}

function lastNameSegment(value: string): string {
	const parts = value.split('.').filter(Boolean)
	return parts[parts.length - 1] || value
}

function propertyKey(value: string): string {
	if (isIdentifier(value)) {
		return value
	}
	return `'${escapeTypeString(value)}'`
}

function isIdentifier(value: string): boolean {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
}

function escapeTypeString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export function getDrizzleHelpers(): string[] {
	return [
		'eq',
		'ne',
		'gt',
		'lt',
		'gte',
		'lte',
		'like',
		'ilike',
		'inArray',
		'notInArray',
		'isNull',
		'isNotNull',
		'and',
		'or',
		'not',
		'asc',
		'desc',
		'count',
		'countDistinct',
		'sum',
		'sumDistinct',
		'avg',
		'min',
		'max',
		'arrayContains',
		'arrayContained',
		'arrayOverlaps',
		'param'
	]
}

export function getTableNames(tables: SchemaTable[]): string[] {
	return tables.map(function (table) {
		return table.name
	})
}

export function getColumnNames(tables: SchemaTable[], tableName: string): string[] {
	const table = tables.find(function (item) {
		return item.name === tableName
	})
	if (!table) return []
	return table.columns.map(function (column) {
		return column.name
	})
}

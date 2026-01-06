// ============================================
// SQL Query Factory - Functional Programming Approach
// ============================================

// Core utilities (pure functions)
const escapeIdentifier = (name: string): string =>
    `"${name.replace(/"/g, '""')}"`

const qualifiedTable = (table: string, schema?: string): string =>
    schema
        ? `${escapeIdentifier(schema)}.${escapeIdentifier(table)}`
        : escapeIdentifier(table)

const joinParts = (parts: string[]): string =>
    parts.filter(Boolean).join(' ')

// ============================================
// Query clause builders (composable)
// ============================================

export type QueryOptions = {
    schema?: string
    limit?: number
    offset?: number
    orderBy?: { column: string; direction?: 'ASC' | 'DESC' }
    where?: string
}

const withWhere = (where?: string) =>
    where ? `WHERE ${where}` : ''

const withOrderBy = (orderBy?: QueryOptions['orderBy']) =>
    orderBy
        ? `ORDER BY ${escapeIdentifier(orderBy.column)} ${orderBy.direction ?? 'ASC'}`
        : ''

const withLimit = (limit?: number) =>
    limit ? `LIMIT ${limit}` : ''

const withOffset = (offset?: number) =>
    offset ? `OFFSET ${offset}` : ''

// ============================================
// Query builders (pure functions)
// ============================================

export const selectAll = (table: string, options: QueryOptions = {}): string =>
    joinParts([
        `SELECT * FROM ${qualifiedTable(table, options.schema)}`,
        withWhere(options.where),
        withOrderBy(options.orderBy),
        withLimit(options.limit),
        withOffset(options.offset),
    ]) + ';'

export const select = (columns: string[]) => (table: string, options: QueryOptions = {}): string =>
    joinParts([
        `SELECT ${columns.map(escapeIdentifier).join(', ')} FROM ${qualifiedTable(table, options.schema)}`,
        withWhere(options.where),
        withOrderBy(options.orderBy),
        withLimit(options.limit),
        withOffset(options.offset),
    ]) + ';'

export const count = (table: string, options: Pick<QueryOptions, 'schema' | 'where'> = {}): string =>
    joinParts([
        `SELECT COUNT(*) as count FROM ${qualifiedTable(table, options.schema)}`,
        withWhere(options.where),
    ]) + ';'

export const insert = (table: string, schema?: string) => (data: Record<string, unknown>): { sql: string; values: unknown[] } => {
    const keys = Object.keys(data)
    return {
        sql: `INSERT INTO ${qualifiedTable(table, schema)} (${keys.map(escapeIdentifier).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')});`,
        values: Object.values(data),
    }
}

export const update = (table: string, schema?: string) => (data: Record<string, unknown>, where: string): { sql: string; values: unknown[] } => {
    const keys = Object.keys(data)
    return {
        sql: `UPDATE ${qualifiedTable(table, schema)} SET ${keys.map((k, i) => `${escapeIdentifier(k)} = $${i + 1}`).join(', ')} WHERE ${where};`,
        values: Object.values(data),
    }
}

export const deleteFrom = (table: string, schema?: string) => (where: string): string =>
    `DELETE FROM ${qualifiedTable(table, schema)} WHERE ${where};`

// ============================================
// Curried table helpers (partial application)
// ============================================

/** Create a query builder scoped to a specific table */
export const forTable = (table: string, schema?: string) => ({
    selectAll: (options: Omit<QueryOptions, 'schema'> = {}) =>
        selectAll(table, { ...options, schema }),

    select: (columns: string[], options: Omit<QueryOptions, 'schema'> = {}) =>
        select(columns)(table, { ...options, schema }),

    count: (where?: string) =>
        count(table, { schema, where }),

    insert: insert(table, schema),

    update: update(table, schema),

    delete: deleteFrom(table, schema),
})

// ============================================
// Prebuilt common queries (using composition)
// ============================================

export const tablePreview = (table: string, schema?: string, limit = 100): string =>
    selectAll(table, { schema, limit })

export const tableRowCount = (table: string, schema?: string): string =>
    count(table, { schema })

// Postgres-specific introspection queries
export const describeTable = (table: string, schema?: string): string =>
    `SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = '${table}'${schema ? ` AND table_schema = '${schema}'` : ''}
   ORDER BY ordinal_position;`

export const getPrimaryKeys = (table: string, schema?: string): string =>
    `SELECT kcu.column_name
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
   WHERE tc.table_name = '${table}'${schema ? ` AND tc.table_schema = '${schema}'` : ''}
   AND tc.constraint_type = 'PRIMARY KEY';`

export const getForeignKeys = (table: string, schema?: string): string =>
    `SELECT
     kcu.column_name,
     ccu.table_schema AS foreign_table_schema,
     ccu.table_name AS foreign_table_name,
     ccu.column_name AS foreign_column_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_name = '${table}'${schema ? ` AND tc.table_schema = '${schema}'` : ''};`

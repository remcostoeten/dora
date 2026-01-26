import type { DatabaseSchema, TableInfo, ColumnInfo } from '@/lib/bindings'

type DrizzleColumnType =
    | 'integer'
    | 'text'
    | 'varchar'
    | 'boolean'
    | 'timestamp'
    | 'serial'
    | 'bigint'
    | 'real'
    | 'doublePrecision'
    | 'json'
    | 'jsonb'
    | 'uuid'
    | 'date'
    | 'time'

function mapSqlTypeToDrizzle(sqlType: string): { type: DrizzleColumnType; args?: string } {
    const normalized = sqlType.toLowerCase().trim()

    if (normalized.includes('serial')) {
        return { type: 'serial' }
    }
    if (normalized.includes('bigint') || normalized.includes('int8')) {
        return { type: 'bigint', args: "{ mode: 'number' }" }
    }
    if (normalized.includes('int') || normalized.includes('integer')) {
        return { type: 'integer' }
    }
    if (normalized.includes('real') || normalized.includes('float4')) {
        return { type: 'real' }
    }
    if (normalized.includes('double') || normalized.includes('float8') || normalized.includes('numeric') || normalized.includes('decimal')) {
        return { type: 'doublePrecision' }
    }
    if (normalized.includes('bool')) {
        return { type: 'boolean' }
    }
    if (normalized.includes('timestamp')) {
        return { type: 'timestamp' }
    }
    if (normalized.includes('date')) {
        return { type: 'date' }
    }
    if (normalized.includes('time')) {
        return { type: 'time' }
    }
    if (normalized.includes('uuid')) {
        return { type: 'uuid' }
    }
    if (normalized.includes('jsonb')) {
        return { type: 'jsonb' }
    }
    if (normalized.includes('json')) {
        return { type: 'json' }
    }
    if (normalized.includes('varchar') || normalized.includes('character varying')) {
        const match = normalized.match(/\((\d+)\)/)
        if (match) {
            return { type: 'varchar', args: `{ length: ${match[1]} }` }
        }
        return { type: 'varchar', args: '{ length: 255 }' }
    }
    if (normalized.includes('char')) {
        return { type: 'varchar', args: '{ length: 255 }' }
    }

    return { type: 'text' }
}

function toSnakeCase(str: string): string {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '')
        .replace(/-/g, '_')
}

function toCamelCase(str: string): string {
    return str
        .split('_')
        .map(function (word, index) {
            if (index === 0) return word.toLowerCase()
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
        .join('')
}

function generateColumnDefinition(col: ColumnInfo, tableName: string): string {
    const { type, args } = mapSqlTypeToDrizzle(col.data_type)
    const columnName = col.name

    let definition = `\t${toCamelCase(columnName)}: ${type}('${columnName}'`

    if (args) {
        definition += `, ${args}`
    }

    definition += ')'

    if (col.is_primary_key) {
        definition += '.primaryKey()'
    }

    if (!col.is_nullable && !col.is_primary_key) {
        definition += '.notNull()'
    }

    if (col.default_value) {
        const defaultVal = col.default_value
        if (defaultVal.toLowerCase().includes('now()') || defaultVal.toLowerCase().includes('current_timestamp')) {
            definition += '.defaultNow()'
        } else if (defaultVal.toLowerCase() === 'true' || defaultVal.toLowerCase() === 'false') {
            definition += `.default(${defaultVal.toLowerCase()})`
        } else if (!isNaN(Number(defaultVal))) {
            definition += `.default(${defaultVal})`
        }
    }

    return definition
}

function generateTableDefinition(table: TableInfo): string {
    const tableName = table.name
    const variableName = toCamelCase(tableName)

    const columns = table.columns.map(function (col) {
        return generateColumnDefinition(col, tableName)
    })

    return `export const ${variableName} = pgTable('${tableName}', {
${columns.join(',\n')}
})`
}

export function convertSchemaToDrizzle(schema: DatabaseSchema): string {
    const header = `import { pgTable, serial, text, varchar, integer, boolean, timestamp, bigint, real, doublePrecision, json, jsonb, uuid, date, time } from 'drizzle-orm/pg-core'`

    const tableDefinitions = schema.tables.map(function (table) {
        return generateTableDefinition(table)
    })

    return `${header}\n\n${tableDefinitions.join('\n\n')}\n`
}

export function convertDDLToDrizzle(ddl: string, schema?: DatabaseSchema): string {
    if (schema) {
        return convertSchemaToDrizzle(schema)
    }

    const header = `import { pgTable, serial, text, varchar, integer, boolean, timestamp, bigint, real, doublePrecision, json, jsonb, uuid, date, time } from 'drizzle-orm/pg-core'`

    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s*\(([\s\S]*?)\);/gi
    const tables: string[] = []

    let match
    while ((match = createTableRegex.exec(ddl)) !== null) {
        const tableName = match[1]
        const columnsBlock = match[2]
        const variableName = toCamelCase(tableName)

        const columnLines = columnsBlock
            .split(',')
            .map(function (line) { return line.trim() })
            .filter(function (line) {
                return line.length > 0 &&
                    !line.toUpperCase().startsWith('PRIMARY KEY') &&
                    !line.toUpperCase().startsWith('FOREIGN KEY') &&
                    !line.toUpperCase().startsWith('CONSTRAINT') &&
                    !line.toUpperCase().startsWith('UNIQUE')
            })

        const columns: string[] = []
        for (const line of columnLines) {
            const parts = line.match(/["']?(\w+)["']?\s+(\w+(?:\([^)]*\))?)/i)
            if (parts) {
                const colName = parts[1]
                const colType = parts[2]
                const { type, args } = mapSqlTypeToDrizzle(colType)

                let colDef = `\t${toCamelCase(colName)}: ${type}('${colName}'`
                if (args) {
                    colDef += `, ${args}`
                }
                colDef += ')'

                if (line.toUpperCase().includes('PRIMARY KEY')) {
                    colDef += '.primaryKey()'
                }
                if (line.toUpperCase().includes('NOT NULL') && !line.toUpperCase().includes('PRIMARY KEY')) {
                    colDef += '.notNull()'
                }

                columns.push(colDef)
            }
        }

        tables.push(`export const ${variableName} = pgTable('${tableName}', {
${columns.join(',\n')}
})`)
    }

    if (tables.length === 0) {
        return `// Could not parse DDL. Please provide a valid SQL schema.\n// Original DDL:\n// ${ddl.split('\n').join('\n// ')}`
    }

    return `${header}\n\n${tables.join('\n\n')}\n`
}

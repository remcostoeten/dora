import { guessFakerFunction } from './schema-analyzer'

export type TableColumn = {
    name: string
    type: string
    isNullable?: boolean
    isPrimaryKey?: boolean
}

export type GeneratedRow = Record<string, any>

export function generateData(columns: TableColumn[], count: number): GeneratedRow[] {
    const generatorMap = new Map<string, () => any>()

    // Pre-calculate generators for each column
    columns.forEach(col => {
        if (col.isPrimaryKey) return // Skip direct PK generation (often auto-increment or handled by DB, unless UUID)

        // Wait, for UUID PKs we MIGHT want to generate them if the DB doesn't auto-gen.
        // For simplicity now, let's generate values for everything except likely auto-increments (generically named 'id' with type int)
        // But for safety, let's create a map for all non-serial columns.

        generatorMap.set(col.name, guessFakerFunction(col.name, col.type))
    })

    const rows: GeneratedRow[] = []

    for (let i = 0; i < count; i++) {
        const row: GeneratedRow = {}
        generatorMap.forEach((fn, colName) => {
            row[colName] = fn()
        })
        rows.push(row)
    }

    return rows
}

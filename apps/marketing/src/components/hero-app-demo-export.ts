import type { TDemoColumn } from '@/components/hero-app-demo-tables'
import { noop } from '@/shared/lib/noop'

/**
 * Client-side export helpers for the hero demo: the mock's Export menus
 * produce real downloads built from the in-memory rows, mirroring the real
 * app's Export JSON / CSV / SQL INSERT actions.
 */

export type TExportFormat = 'json' | 'csv' | 'sql'

function quoteCsv(value: string): string {
    if (/[",\n]/.test(value)) return '"' + value.replaceAll('"', '""') + '"'
    return value
}

function quoteSql(column: TDemoColumn, value: string): string {
    if (value === '') return 'NULL'
    if (
        column.kind === 'pk' ||
        column.kind === 'fk' ||
        column.kind === 'number' ||
        column.kind === 'money'
    ) {
        return value
    }
    return "'" + value.replaceAll("'", "''") + "'"
}

export function rowsToJson(columns: TDemoColumn[], rows: string[][]): string {
    const records = rows.map((row) =>
        Object.fromEntries(
            columns.map((column, index) => [column.name, row[index] || null])
        )
    )
    return JSON.stringify(records, null, 2)
}

export function rowsToCsv(columns: TDemoColumn[], rows: string[][]): string {
    const head = columns.map((column) => column.name).join(',')
    const body = rows.map((row) =>
        columns.map((column, index) => quoteCsv(row[index] ?? '')).join(',')
    )
    return [head, ...body].join('\n')
}

export function rowsToInsert(
    tableName: string,
    columns: TDemoColumn[],
    rows: string[][]
): string {
    const names = columns.map((column) => column.name).join(', ')
    return rows
        .map(
            (row) =>
                `INSERT INTO ${tableName} (${names}) VALUES (` +
                columns
                    .map((column, index) => quoteSql(column, row[index] ?? ''))
                    .join(', ') +
                ');'
        )
        .join('\n')
}

export function rowsToTsv(columns: TDemoColumn[], rows: string[][]): string {
    return rows
        .map((row) => columns.map((_, index) => row[index] ?? '').join('\t'))
        .join('\n')
}

export function copyText(text: string) {
    navigator.clipboard.writeText(text).catch(noop)
}

export function downloadText(filename: string, text: string, mime: string) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

export function exportRows(
    format: TExportFormat,
    tableName: string,
    columns: TDemoColumn[],
    rows: string[][]
) {
    if (format === 'json') {
        downloadText(
            tableName + '.json',
            rowsToJson(columns, rows),
            'application/json'
        )
        return
    }
    if (format === 'csv') {
        downloadText(tableName + '.csv', rowsToCsv(columns, rows), 'text/csv')
        return
    }
    downloadText(
        tableName + '.sql',
        rowsToInsert(tableName, columns, rows),
        'application/sql'
    )
}

import type { ColumnDefinition } from '../types'

export type ColumnMapping = Record<string, string | null>

export function autoMapColumns(csvHeaders: string[], dbColumns: ColumnDefinition[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const dbByLower = new Map(dbColumns.map((c) => [c.name.toLowerCase(), c.name]))

  for (const header of csvHeaders) {
    mapping[header] = dbByLower.get(header.toLowerCase()) ?? null
  }
  return mapping
}

export function detectTypeMismatch(value: string, dbType: string): string | null {
  if (value === '') return null

  const type = dbType.toLowerCase()

  if (type.includes('int') || type === 'serial' || type === 'bigserial') {
    return Number.isInteger(Number(value)) ? null : `Expected integer, got "${value}"`
  }
  if (type.includes('float') || type.includes('double') || type.includes('numeric') || type.includes('decimal')) {
    return isFinite(Number(value)) ? null : `Expected number, got "${value}"`
  }
  if (type === 'bool' || type === 'boolean') {
    const lower = value.toLowerCase()
    return ['true', 'false', '1', '0', 't', 'f', 'yes', 'no'].includes(lower)
      ? null
      : `Expected boolean, got "${value}"`
  }
  return null
}

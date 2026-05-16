import { describe, it, expect } from 'vitest'
import { autoMapColumns, detectTypeMismatch } from '@/features/database-studio/utils/csv-type-check'
import type { ColumnDefinition } from '@/features/database-studio/types'

const cols: ColumnDefinition[] = [
  { name: 'id', type: 'int4', nullable: false, primaryKey: true },
  { name: 'name', type: 'text', nullable: false, primaryKey: false },
  { name: 'score', type: 'float8', nullable: true, primaryKey: false },
]

describe('autoMapColumns', () => {
  it('maps CSV headers to DB columns by exact name (case-insensitive)', () => {
    const mapping = autoMapColumns(['Name', 'Score', 'email'], cols)
    expect(mapping['Name']).toBe('name')
    expect(mapping['Score']).toBe('score')
    expect(mapping['email']).toBeNull()
  })

  it('returns null for unmatched headers', () => {
    const mapping = autoMapColumns(['nonexistent'], cols)
    expect(mapping['nonexistent']).toBeNull()
  })
})

describe('detectTypeMismatch', () => {
  it('returns null for valid integer value', () => {
    expect(detectTypeMismatch('42', 'int4')).toBeNull()
  })

  it('returns warning for non-numeric value mapped to integer column', () => {
    expect(detectTypeMismatch('abc', 'int4')).toContain('integer')
  })

  it('returns null for float column with valid float string', () => {
    expect(detectTypeMismatch('3.14', 'float8')).toBeNull()
  })

  it('returns null for text column with any value', () => {
    expect(detectTypeMismatch('anything', 'text')).toBeNull()
  })

  it('returns null for empty string (treated as NULL)', () => {
    expect(detectTypeMismatch('', 'int4')).toBeNull()
  })

  it('returns null for valid boolean', () => {
    expect(detectTypeMismatch('true', 'boolean')).toBeNull()
    expect(detectTypeMismatch('0', 'bool')).toBeNull()
  })

  it('returns warning for invalid boolean', () => {
    expect(detectTypeMismatch('maybe', 'boolean')).toContain('boolean')
  })
})

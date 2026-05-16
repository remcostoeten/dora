import { describe, it, expect } from 'vitest'
import { parseCSV } from '@/features/database-studio/utils/csv-parser'

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const result = parseCSV('name,age\nAlice,30\nBob,25')
    expect(result.headers).toEqual(['name', 'age'])
    expect(result.rows).toEqual([['Alice', '30'], ['Bob', '25']])
  })

  it('handles quoted fields with commas', () => {
    const result = parseCSV('name,address\n"Smith, John","123 Main St"')
    expect(result.rows[0]).toEqual(['Smith, John', '123 Main St'])
  })

  it('handles escaped quotes inside quoted field', () => {
    const result = parseCSV('note\n"say ""hello"""')
    expect(result.rows[0][0]).toBe('say "hello"')
  })

  it('handles empty fields', () => {
    const result = parseCSV('a,b,c\n1,,3')
    expect(result.rows[0]).toEqual(['1', '', '3'])
  })

  it('handles CRLF line endings', () => {
    const result = parseCSV('a,b\r\n1,2\r\n3,4')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1]).toEqual(['3', '4'])
  })

  it('returns error for empty input', () => {
    const result = parseCSV('')
    expect(result.error).toBeTruthy()
  })

  it('returns no error and empty rows for header-only file', () => {
    const result = parseCSV('name,age')
    expect(result.rows).toHaveLength(0)
    expect(result.error).toBeUndefined()
  })
})

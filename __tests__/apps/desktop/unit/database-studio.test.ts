import { describe, it, expect } from 'vitest'

describe('Export Utilities', function () {
    describe('CSV export formatting', function () {
        it('should format single value correctly', function () {
            const value = 'Hello World'
            const escaped = value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value
            expect(escaped).toBe('Hello World')
        })

        it('should escape values containing commas', function () {
            const value = 'Hello, World'
            const escaped = value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value
            expect(escaped).toBe('"Hello, World"')
        })

        it('should escape values containing double quotes', function () {
            const value = 'He said "Hello"'
            const escaped = value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value
            expect(escaped).toBe('"He said ""Hello"""')
        })

        it('should escape values containing newlines', function () {
            const value = 'Line1\nLine2'
            const escaped = value.includes(',') || value.includes('"') || value.includes('\n')
                ? `"${value.replace(/"/g, '""')}"`
                : value
            expect(escaped).toBe('"Line1\nLine2"')
        })

        it('should handle null values', function () {
            const value = null
            const escaped = value === null ? '' : String(value)
            expect(escaped).toBe('')
        })
    })

    describe('SQL INSERT formatting', function () {
        it('should escape single quotes in string values', function () {
            const value = "O'Brien"
            const escaped = `'${String(value).replace(/'/g, "''")}'`
            expect(escaped).toBe("'O''Brien'")
        })

        it('should format numbers without quotes', function () {
            const value = 42
            const formatted = typeof value === 'number' ? String(value) : `'${String(value)}'`
            expect(formatted).toBe('42')
        })

        it('should format NULL correctly', function () {
            const value = null
            const formatted = value === null ? 'NULL' : String(value)
            expect(formatted).toBe('NULL')
        })

        it('should generate valid INSERT statement', function () {
            const tableName = 'users'
            const columns = ['id', 'name', 'email']
            const values = [1, "John", "john@example.com"]

            function formatValue(v: unknown): string {
                if (v === null) return 'NULL'
                if (typeof v === 'number') return String(v)
                return `'${String(v).replace(/'/g, "''")}'`
            }

            const insert = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.map(formatValue).join(', ')});`
            expect(insert).toBe("INSERT INTO users (id, name, email) VALUES (1, 'John', 'john@example.com');")
        })
    })
})

describe('Cell Selection Utilities', function () {
    function getCellKey(row: number, col: number): string {
        return `${row}:${col}`
    }

    function getCellsInRectangle(start: { row: number; col: number }, end: { row: number; col: number }): Set<string> {
        const minRow = Math.min(start.row, end.row)
        const maxRow = Math.max(start.row, end.row)
        const minCol = Math.min(start.col, end.col)
        const maxCol = Math.max(start.col, end.col)

        const cells = new Set<string>()
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                cells.add(getCellKey(r, c))
            }
        }
        return cells
    }

    it('should generate correct cell key', function () {
        expect(getCellKey(0, 0)).toBe('0:0')
        expect(getCellKey(5, 10)).toBe('5:10')
    })

    it('should select single cell', function () {
        const cells = getCellsInRectangle({ row: 2, col: 3 }, { row: 2, col: 3 })
        expect(cells.size).toBe(1)
        expect(cells.has('2:3')).toBe(true)
    })

    it('should select rectangular range', function () {
        const cells = getCellsInRectangle({ row: 0, col: 0 }, { row: 2, col: 2 })
        expect(cells.size).toBe(9)
        expect(cells.has('0:0')).toBe(true)
        expect(cells.has('1:1')).toBe(true)
        expect(cells.has('2:2')).toBe(true)
    })

    it('should handle inverted selection (end before start)', function () {
        const cells = getCellsInRectangle({ row: 2, col: 2 }, { row: 0, col: 0 })
        expect(cells.size).toBe(9)
    })
})

describe('Clipboard Formatting', function () {
    it('should format cells as tab-separated values', function () {
        const selectedCells = [
            { row: 0, col: 0, value: 'A1' },
            { row: 0, col: 1, value: 'B1' },
            { row: 1, col: 0, value: 'A2' },
            { row: 1, col: 1, value: 'B2' }
        ]

        const minRow = 0
        const maxRow = 1
        const rowData: string[][] = []

        for (let r = minRow; r <= maxRow; r++) {
            const rowCells = selectedCells.filter(function (c) { return c.row === r })
            rowCells.sort(function (a, b) { return a.col - b.col })
            rowData.push(rowCells.map(function (c) { return String(c.value) }))
        }

        const clipboardText = rowData.map(function (r) { return r.join('\t') }).join('\n')
        expect(clipboardText).toBe('A1\tB1\nA2\tB2')
    })

    it('should handle null values as empty strings', function () {
        const value = null
        const text = value === null || value === undefined ? '' : String(value)
        expect(text).toBe('')
    })

    it('should parse tab-separated clipboard data', function () {
        const clipboardText = 'A1\tB1\nA2\tB2'
        const rows = clipboardText.split('\n').map(function (line) {
            return line.split('\t')
        })

        expect(rows).toEqual([
            ['A1', 'B1'],
            ['A2', 'B2']
        ])
    })
})

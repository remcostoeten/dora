import { describe, it, expect } from 'vitest'
import {
    levenshtein,
    similarity,
    findClosestMatch,
    getSuggestions,
    createDrizzleTypoDetector,
    createPrismaTypoDetector,
    createSqlTypoDetector
} from './fuzzy-match'

describe('Fuzzy Matching Utilities', () => {
    describe('levenshtein', () => {
        it('calculates distance correctly', () => {
            expect(levenshtein('kitten', 'sitting')).toBe(3)
            expect(levenshtein('book', 'back')).toBe(2)
            expect(levenshtein('test', 'test')).toBe(0)
            expect(levenshtein('', 'abc')).toBe(3)
            expect(levenshtein('abc', '')).toBe(3)
        })

        it('is case insensitive', () => {
            expect(levenshtein('Test', 'test')).toBe(0)
            expect(levenshtein('Kitten', 'sitting')).toBe(3)
        })
    })

    describe('similarity', () => {
        it('calculates similarity score 0-1', () => {
            expect(similarity('test', 'test')).toBe(1)
            expect(similarity('abc', 'def')).toBe(0)
            expect(similarity('hook', 'book')).toBe(0.75) // 1 diff / 4 length = 0.25 dist -> 0.75 sim
        })
    })

    describe('findClosestMatch', () => {
        const candidates = ['users', 'products', 'orders', 'order_items']

        it('finds exact match', () => {
            const match = findClosestMatch('users', candidates)
            expect(match?.value).toBe('users')
            expect(match?.distance).toBe(0)
        })

        it('finds close match', () => {
            const match = findClosestMatch('usr', candidates)
            expect(match?.value).toBe('users')
        })

        it('respects threshold', () => {
            const match = findClosestMatch('xzq', candidates, 2)
            expect(match).toBeNull()
        })
    })

    describe('getSuggestions', () => {
        const candidates = ['apple', 'apply', 'apricot', 'banana']

        it('returns ranked suggestions', () => {
            const suggestions = getSuggestions('appl', candidates)
            expect(suggestions).toHaveLength(2)
            expect(suggestions[0].value).toBe('apple') // dist 1
            expect(suggestions[1].value).toBe('apply') // dist 1
        })
    })
})

describe('Typo Detectors', () => {
    const mockSchema = [
        { name: 'users', columns: [{ name: 'id' }, { name: 'email' }] },
        { name: 'posts', columns: [{ name: 'id' }, { name: 'userId' }, { name: 'title' }] }
    ]

    describe('Drizzle Detector', () => {
        const detect = createDrizzleTypoDetector(mockSchema)

        it('ignores reserved words', () => {
            const typos = detect('db.select().from(users)')
            expect(typos).toHaveLength(0)
        })

        it('detects table name typo', () => {
            const typos = detect('db.select().from(usrs)')
            expect(typos).toHaveLength(1)
            expect(typos[0].word).toBe('usrs')
            expect(typos[0].suggestion).toBe('users')
        })

        it('detects column typo in dot notation', () => {
            const typos = detect('eq(users.emai, "test")')
            expect(typos).toHaveLength(1)
            expect(typos[0].word).toBe('users.emai')
            expect(typos[0].suggestion).toBe('users.email')
        })
    })

    describe('Prisma Detector', () => {
        const detect = createPrismaTypoDetector(mockSchema)

        it('ignores prisma keywords', () => {
            const typos = detect('prisma.users.findMany({ where: { id: 1 } })')
            expect(typos).toHaveLength(0)
        })

        it('detects model typo', () => {
            // Testing simple model name which is the common case in many contexts
            const typos = detect('const x = usrs')
            expect(typos).toHaveLength(1)
            expect(typos[0].suggestion).toBe('users')
        })
    })

    describe('SQL Detector', () => {
        const detect = createSqlTypoDetector(mockSchema)

        it('ignores SQL keywords case-insensitive', () => {
            const typos = detect('SELECT * FROM users WHERE id = 1')
            expect(typos).toHaveLength(0)
        })

        it('detects typo in SQL', () => {
            const typos = detect('SELECT * FROM usrs')
            expect(typos).toHaveLength(1)
            expect(typos[0].suggestion).toBe('users')
        })
    })
})

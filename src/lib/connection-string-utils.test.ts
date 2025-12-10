/**
 * Tests for connection-string-utils.ts
 * Run with: bun test src/lib/connection-string-utils.test.ts
 */

import { describe, it, expect } from 'bun:test'
import {
    analyzeConnectionString,
    formatCorrectionMessage,
    suggestConnectionName,
    validateConnectionString,
} from './connection-string-utils'

describe('analyzeConnectionString', () => {
    describe('prefix stripping', () => {
        it('strips DATABASE_URL= prefix', () => {
            const result = analyzeConnectionString('DATABASE_URL=postgresql://localhost/db')
            expect(result.cleaned).toBe('postgresql://localhost/db')
            expect(result.strippedPrefix).toBe('DATABASE_URL=')
            expect(result.wasModified).toBe(true)
        })

        it('strips DATABASE_URL= with quotes', () => {
            const result = analyzeConnectionString('DATABASE_URL="postgresql://localhost/db"')
            expect(result.cleaned).toBe('postgresql://localhost/db')
        })

        it('strips DB_URL= prefix', () => {
            const result = analyzeConnectionString('DB_URL=postgresql://localhost/db')
            expect(result.cleaned).toBe('postgresql://localhost/db')
        })

        it('strips export DATABASE_URL= prefix', () => {
            const result = analyzeConnectionString('export DATABASE_URL=postgresql://localhost/db')
            expect(result.cleaned).toBe('postgresql://localhost/db')
        })

        it('handles no prefix', () => {
            const result = analyzeConnectionString('postgresql://localhost/db')
            expect(result.cleaned).toBe('postgresql://localhost/db')
            expect(result.strippedPrefix).toBeNull()
        })
    })

    describe('typo detection', () => {
        it('corrects postttgr to postgres', () => {
            const result = analyzeConnectionString('postttgr://localhost/db')
            expect(result.cleaned).toBe('postgres://localhost/db')
            expect(result.corrections).toHaveLength(1)
            expect(result.corrections[0]).toEqual({ original: 'postttgr', corrected: 'postgres' })
        })

        it('corrects postgress to postgres', () => {
            const result = analyzeConnectionString('postgress://localhost/db')
            expect(result.cleaned).toBe('postgres://localhost/db')
        })

        it('corrects postgressql to postgresql', () => {
            const result = analyzeConnectionString('postgressql://localhost/db')
            expect(result.cleaned).toBe('postgresql://localhost/db')
        })
    })

    describe('database type detection', () => {
        it('detects postgres from URL', () => {
            const result = analyzeConnectionString('postgresql://localhost/db')
            expect(result.detectedType).toBe('postgres')
        })

        it('detects sqlite from .db extension', () => {
            const result = analyzeConnectionString('/path/to/database.db')
            expect(result.detectedType).toBe('sqlite')
        })

        it('returns unknown for ambiguous input', () => {
            const result = analyzeConnectionString('localhost:5432')
            expect(result.detectedType).toBe('unknown')
        })
    })

    describe('combined scenarios', () => {
        it('strips prefix AND corrects typo', () => {
            const result = analyzeConnectionString('DATABASE_URL=postttgr://localhost/db')
            expect(result.cleaned).toBe('postgres://localhost/db')
            expect(result.strippedPrefix).toBe('DATABASE_URL=')
            expect(result.corrections).toHaveLength(1)
            expect(result.wasModified).toBe(true)
        })
    })
})

describe('formatCorrectionMessage', () => {
    it('formats prefix strip message', () => {
        const analysis = analyzeConnectionString('DATABASE_URL=postgresql://localhost/db')
        const message = formatCorrectionMessage(analysis)
        expect(message).toContain('Stripped prefix')
    })

    it('formats typo correction message', () => {
        const analysis = analyzeConnectionString('postttgr://localhost/db')
        const message = formatCorrectionMessage(analysis)
        expect(message).toContain('Corrected')
        expect(message).toContain('postttgr')
        expect(message).toContain('postgres')
    })

    it('returns null for no modifications', () => {
        const analysis = analyzeConnectionString('postgresql://localhost/db')
        const message = formatCorrectionMessage(analysis)
        expect(message).toBeNull()
    })
})

describe('suggestConnectionName', () => {
    it('extracts name from postgres URL', () => {
        const name = suggestConnectionName('postgresql://user:pass@localhost:5432/mydb', 'postgres')
        expect(name).toBe('Local - mydb')
    })

    it('uses host for remote connections', () => {
        const name = suggestConnectionName('postgresql://user:pass@prod.example.com:5432/app', 'postgres')
        expect(name).toBe('prod.example.com - app')
    })

    it('extracts filename from sqlite path', () => {
        const name = suggestConnectionName('/path/to/mydata.db', 'sqlite')
        expect(name).toBe('mydata')
    })
})

describe('validateConnectionString', () => {
    describe('postgres validation', () => {
        it('accepts valid postgres URL', () => {
            const result = validateConnectionString('postgresql://localhost/db', 'postgres')
            expect(result.valid).toBe(true)
        })

        it('rejects missing protocol', () => {
            const result = validateConnectionString('localhost/db', 'postgres')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('postgresql://')
        })

        it('rejects empty string', () => {
            const result = validateConnectionString('', 'postgres')
            expect(result.valid).toBe(false)
        })
    })

    describe('sqlite validation', () => {
        it('accepts valid sqlite path', () => {
            const result = validateConnectionString('/path/to/database.db', 'sqlite')
            expect(result.valid).toBe(true)
        })

        it('warns if postgres URL given for sqlite', () => {
            const result = validateConnectionString('postgresql://localhost/db', 'sqlite')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('PostgreSQL URL')
        })
    })
})

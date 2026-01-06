import { describe, it, expect } from 'vitest'
import {
    prettifyCode,
    prettifySQL,
    prettifyJSON,
    prettifyYAML,
    minifySQL,
    minifyJSON,
    detectLanguage,
    validateSyntax,
    getSupportedLanguages,
} from '@/core/formatters/code-prettifier'

describe('Code Prettifier', () => {
    describe('prettifySQL', () => {
        it('should format a simple SELECT query', () => {
            const input = 'SELECT id, name, email FROM users WHERE active = true'
            const result = prettifySQL(input)

            expect(result.success).toBe(true)
            expect(result.language).toBe('postgresql')
            expect(result.formatted).toContain('SELECT')
            expect(result.formatted).toContain('FROM')
            expect(result.formatted).toContain('WHERE')
        })

        it('should format complex SQL with JOINs', () => {
            const input = `SELECT u.id, u.name, o.total FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE o.status = 'completed' ORDER BY o.created_at DESC`
            const result = prettifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('LEFT JOIN')
            expect(result.formatted).toContain('ORDER BY')
        })

        it('should uppercase keywords', () => {
            const input = 'select * from users where id = 1'
            const result = prettifySQL(input, { uppercaseKeywords: true })

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('SELECT')
            expect(result.formatted).toContain('FROM')
            expect(result.formatted).toContain('WHERE')
        })

        it('should handle INSERT statements', () => {
            const input = `INSERT INTO users (name, email) VALUES ('John', 'john@example.com')`
            const result = prettifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('INSERT INTO')
            expect(result.formatted).toContain('VALUES')
        })

        it('should handle UPDATE statements', () => {
            const input = `UPDATE users SET name = 'Jane', updated_at = NOW() WHERE id = 1`
            const result = prettifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('UPDATE')
            expect(result.formatted).toContain('SET')
        })

        it('should handle CREATE TABLE statements', () => {
            const input = `CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, price DECIMAL(10,2), created_at TIMESTAMP DEFAULT NOW())`
            const result = prettifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('CREATE TABLE')
        })
    })

    describe('prettifyJSON', () => {
        it('should format valid JSON', () => {
            const input = '{"name":"John","age":30,"city":"New York"}'
            const result = prettifyJSON(input)

            expect(result.success).toBe(true)
            expect(result.language).toBe('json')
            expect(result.formatted).toContain('"name": "John"')
        })

        it('should format nested JSON', () => {
            const input = '{"user":{"name":"John","address":{"city":"NYC","zip":"10001"}}}'
            const result = prettifyJSON(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('"user"')
            expect(result.formatted).toContain('"address"')
        })

        it('should format JSON arrays', () => {
            const input = '[1,2,3,{"name":"test"}]'
            const result = prettifyJSON(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('[\n')
        })

        it('should handle JSON with trailing commas', () => {
            const input = '{"name":"John","age":30,}'
            const result = prettifyJSON(input)

            // Should attempt to fix trailing comma
            expect(result.success).toBe(true)
        })

        it('should fail for invalid JSON', () => {
            const input = 'not valid json at all'
            const result = prettifyJSON(input)

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should respect tabWidth option', () => {
            const input = '{"a":1}'
            const result = prettifyJSON(input, { tabWidth: 4 })

            expect(result.success).toBe(true)
            // Should have 4-space indentation
        })
    })

    describe('prettifyYAML', () => {
        it('should format YAML with proper indentation', () => {
            const input = `name: John
age: 30
address:
city: NYC`
            const result = prettifyYAML(input)

            expect(result.success).toBe(true)
            expect(result.language).toBe('yaml')
        })

        it('should handle YAML lists', () => {
            const input = `- item1
- item2
- item3`
            const result = prettifyYAML(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('- item1')
        })
    })

    describe('minifySQL', () => {
        it('should remove extra whitespace', () => {
            const input = `SELECT
        id,
        name,
        email
      FROM
        users
      WHERE
        active = true`
            const result = minifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).not.toContain('\n')
        })

        it('should remove SQL comments', () => {
            const input = `SELECT * FROM users -- this is a comment
      WHERE id = 1`
            const result = minifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).not.toContain('--')
            expect(result.formatted).not.toContain('comment')
        })

        it('should remove multi-line comments', () => {
            const input = `SELECT /* select all columns */ * FROM users`
            const result = minifySQL(input)

            expect(result.success).toBe(true)
            expect(result.formatted).not.toContain('/*')
            expect(result.formatted).not.toContain('*/')
        })
    })

    describe('minifyJSON', () => {
        it('should remove all whitespace from JSON', () => {
            const input = `{
        "name": "John",
        "age": 30
      }`
            const result = minifyJSON(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toBe('{"name":"John","age":30}')
        })

        it('should fail for invalid JSON', () => {
            const input = 'not valid json'
            const result = minifyJSON(input)

            expect(result.success).toBe(false)
        })
    })

    describe('detectLanguage', () => {
        it('should detect SQL from SELECT statement', () => {
            const input = 'SELECT * FROM users'
            expect(detectLanguage(input)).toBe('postgresql')
        })

        it('should detect SQL from INSERT statement', () => {
            const input = 'INSERT INTO users VALUES (1, "test")'
            expect(detectLanguage(input)).toBe('postgresql')
        })

        it('should detect SQL from UPDATE statement', () => {
            const input = 'UPDATE users SET name = "test"'
            expect(detectLanguage(input)).toBe('postgresql')
        })

        it('should detect JSON from object', () => {
            const input = '{"name": "John"}'
            expect(detectLanguage(input)).toBe('json')
        })

        it('should detect JSON from array', () => {
            const input = '[1, 2, 3]'
            expect(detectLanguage(input)).toBe('json')
        })

        it('should detect YAML from document start', () => {
            const input = `---
name: John`
            expect(detectLanguage(input)).toBe('yaml')
        })
    })

    describe('prettifyCode (auto-detection)', () => {
        it('should auto-detect and format SQL', () => {
            const input = 'select * from users where id = 1'
            const result = prettifyCode(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('SELECT')
        })

        it('should auto-detect and format JSON', () => {
            const input = '{"name":"John"}'
            const result = prettifyCode(input)

            expect(result.success).toBe(true)
            expect(result.formatted).toContain('"name"')
        })

        it('should accept explicit language override', () => {
            const input = '{"name":"John"}'
            const result = prettifyCode(input, 'json')

            expect(result.success).toBe(true)
            expect(result.language).toBe('json')
        })
    })

    describe('validateSyntax', () => {
        it('should validate correct JSON', () => {
            const result = validateSyntax('{"valid": true}', 'json')
            expect(result.valid).toBe(true)
        })

        it('should invalidate incorrect JSON', () => {
            const result = validateSyntax('not json', 'json')
            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
        })

        it('should validate SQL', () => {
            const result = validateSyntax('SELECT * FROM users', 'sql')
            expect(result.valid).toBe(true)
        })
    })

    describe('getSupportedLanguages', () => {
        it('should return all supported languages', () => {
            const languages = getSupportedLanguages()

            expect(languages).toContain('sql')
            expect(languages).toContain('postgresql')
            expect(languages).toContain('json')
            expect(languages).toContain('yaml')
        })
    })
})

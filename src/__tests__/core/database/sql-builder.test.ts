/**
 * Comprehensive tests for sql-builder.ts
 * Tests SQL query building with various operations and edge cases
 */

import { describe, it, expect } from 'vitest'
import { SQLQueryBuilder, sql } from '@/core/database/sql-builder'

describe('SQLQueryBuilder', () => {
  describe('SELECT queries', () => {
    it('should build a simple SELECT * query', () => {
      const result = sql.select(['*']).from('users').build()
      
      expect(result.sql).toBe('SELECT * FROM "users"')
      expect(result.params).toEqual([])
    })

    it('should build a SELECT with specific columns', () => {
      const result = sql.select(['id', 'name', 'email']).from('users').build()
      
      expect(result.sql).toBe('SELECT id, name, email FROM "users"')
      expect(result.params).toEqual([])
    })

    it('should build a SELECT with WHERE clause', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .where('id = ?', 1)
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" WHERE id = ?')
      expect(result.params).toEqual([1])
    })

    it('should build a SELECT with multiple WHERE conditions using AND', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .where('age > ?', 18)
        .and('status = ?', 'active')
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" WHERE age > ? AND status = ?')
      expect(result.params).toEqual([18, 'active'])
    })

    it('should build a SELECT with OR conditions', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .where('role = ?', 'admin')
        .or('role = ?', 'moderator')
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" WHERE role = ? OR role = ?')
      expect(result.params).toEqual(['admin', 'moderator'])
    })

    it('should build a SELECT with mixed AND/OR conditions', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .where('age > ?', 18)
        .and('active = ?', true)
        .or('premium = ?', true)
        .build()
      
      expect(result.sql).toContain('WHERE age > ?')
      expect(result.sql).toContain('AND active = ?')
      expect(result.sql).toContain('OR premium = ?')
      expect(result.params).toEqual([18, true, true])
    })

    it('should build a SELECT with ORDER BY', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .orderBy('created_at', 'DESC')
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" ORDER BY "created_at" DESC')
    })

    it('should build a SELECT with ORDER BY ASC (default)', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .orderBy('name')
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" ORDER BY "name" ASC')
    })

    it('should build a SELECT with LIMIT', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .limit(10)
        .build()
      
      expect(result.sql).toBe('SELECT * FROM "users" LIMIT 10')
    })

    it('should build a SELECT with WHERE, ORDER BY, and LIMIT', () => {
      const result = sql
        .select(['id', 'name'])
        .from('users')
        .where('active = ?', true)
        .orderBy('created_at', 'DESC')
        .limit(5)
        .build()
      
      expect(result.sql).toContain('WHERE active = ?')
      expect(result.sql).toContain('ORDER BY "created_at" DESC')
      expect(result.sql).toContain('LIMIT 5')
      expect(result.params).toEqual([true])
    })

    it('should build a SELECT with JOIN', () => {
      const result = sql
        .select(['u.id', 'u.name', 'o.total'])
        .from('users')
        .join('orders', 'users.id = orders.user_id')
        .build()
      
      expect(result.sql).toContain('JOIN "orders" ON users.id = orders.user_id')
    })

    it('should build a SELECT with LEFT JOIN', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .leftJoin('profiles', 'users.id = profiles.user_id')
        .build()
      
      expect(result.sql).toContain('LEFT JOIN "profiles" ON users.id = profiles.user_id')
    })

    it('should build a SELECT with multiple JOINs', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .join('orders', 'users.id = orders.user_id')
        .leftJoin('profiles', 'users.id = profiles.user_id')
        .build()
      
      expect(result.sql).toContain('JOIN "orders"')
      expect(result.sql).toContain('LEFT JOIN "profiles"')
    })

    it('should build a complex SELECT with JOIN, WHERE, ORDER BY, and LIMIT', () => {
      const result = sql
        .select(['u.id', 'u.name', 'COUNT(o.id) as order_count'])
        .from('users')
        .leftJoin('orders', 'u.id = o.user_id')
        .where('u.active = ?', true)
        .orderBy('order_count', 'DESC')
        .limit(10)
        .build()
      
      expect(result.sql).toContain('LEFT JOIN')
      expect(result.sql).toContain('WHERE')
      expect(result.sql).toContain('ORDER BY')
      expect(result.sql).toContain('LIMIT')
    })

    it('should throw error when building SELECT without FROM', () => {
      expect(() => {
        sql.select(['*']).build()
      }).toThrow('Table is required for SELECT query')
    })

    it('should handle empty columns array by defaulting to *', () => {
      const result = sql.select([]).from('users').build()
      expect(result.sql).toContain('SELECT')
    })

    it('should properly escape table names', () => {
      const result = sql.select(['*']).from('users').build()
      expect(result.sql).toContain('"users"')
    })
  })

  describe('INSERT queries', () => {
    it('should build a simple INSERT query', () => {
      const result = sql
        .insert('users')
        .values({ name: 'John', email: 'john@example.com' })
        .build()
      
      expect(result.sql).toContain('INSERT INTO "users"')
      expect(result.sql).toContain('"name"')
      expect(result.sql).toContain('"email"')
      expect(result.sql).toContain('$1')
      expect(result.sql).toContain('$2')
      expect(result.params).toEqual(['John', 'john@example.com'])
    })

    it('should build INSERT with multiple columns', () => {
      const result = sql
        .insert('products')
        .values({
          name: 'Widget',
          price: 29.99,
          stock: 100,
          active: true
        })
        .build()
      
      expect(result.sql).toContain('INSERT INTO "products"')
      expect(result.params).toEqual(['Widget', 29.99, 100, true])
      expect(result.params).toHaveLength(4)
    })

    it('should handle INSERT with null values', () => {
      const result = sql
        .insert('users')
        .values({ name: 'Jane', description: null })
        .build()
      
      expect(result.params).toContain(null)
    })

    it('should handle INSERT with numeric values', () => {
      const result = sql
        .insert('orders')
        .values({ total: 99.99, quantity: 3 })
        .build()
      
      expect(result.params).toEqual([99.99, 3])
    })

    it('should handle INSERT with boolean values', () => {
      const result = sql
        .insert('users')
        .values({ active: true, verified: false })
        .build()
      
      expect(result.params).toEqual([true, false])
    })

    it('should throw error when building INSERT without values', () => {
      expect(() => {
        sql.insert('users').build()
      }).toThrow('Values are required for INSERT query')
    })

    it('should handle INSERT with empty object', () => {
      expect(() => {
        sql.insert('users').values({}).build()
      }).not.toThrow()
    })

    it('should handle INSERT with single column', () => {
      const result = sql
        .insert('logs')
        .values({ message: 'Test log' })
        .build()
      
      expect(result.sql).toContain('INSERT INTO "logs"')
      expect(result.params).toEqual(['Test log'])
    })
  })

  describe('UPDATE queries', () => {
    it('should build a simple UPDATE query', () => {
      const result = sql
        .update('users')
        .set({ name: 'Jane' })
        .where('id = ?', 1)
        .build()
      
      expect(result.sql).toContain('UPDATE "users"')
      expect(result.sql).toContain('SET "name" = $1')
      expect(result.sql).toContain('WHERE id = ?')
      expect(result.params).toEqual(['Jane', 1])
    })

    it('should build UPDATE with multiple SET values', () => {
      const result = sql
        .update('users')
        .set({
          name: 'Jane',
          email: 'jane@example.com',
          age: 30
        })
        .where('id = ?', 1)
        .build()
      
      expect(result.sql).toContain('SET "name" = $1')
      expect(result.sql).toContain('"email" = $2')
      expect(result.sql).toContain('"age" = $3')
      expect(result.params).toEqual(['Jane', 'jane@example.com', 30, 1])
    })

    it('should build UPDATE with multiple WHERE conditions', () => {
      const result = sql
        .update('users')
        .set({ status: 'inactive' })
        .where('last_login < ?', '2023-01-01')
        .and('role = ?', 'user')
        .build()
      
      expect(result.sql).toContain('WHERE last_login < ?')
      expect(result.sql).toContain('AND role = ?')
      expect(result.params).toEqual(['inactive', '2023-01-01', 'user'])
    })

    it('should build UPDATE with OR condition', () => {
      const result = sql
        .update('products')
        .set({ discount: 10 })
        .where('category = ?', 'electronics')
        .or('category = ?', 'books')
        .build()
      
      expect(result.sql).toContain('OR category = ?')
      expect(result.params).toEqual([10, 'electronics', 'books'])
    })

    it('should handle UPDATE with null values', () => {
      const result = sql
        .update('users')
        .set({ description: null })
        .where('id = ?', 1)
        .build()
      
      expect(result.params).toContain(null)
    })

    it('should handle UPDATE with boolean values', () => {
      const result = sql
        .update('users')
        .set({ active: false })
        .where('id = ?', 1)
        .build()
      
      expect(result.params).toContain(false)
    })

    it('should handle UPDATE without WHERE clause', () => {
      const result = sql
        .update('settings')
        .set({ maintenance_mode: true })
        .build()
      
      expect(result.sql).toContain('UPDATE "settings"')
      expect(result.sql).not.toContain('WHERE')
    })

    it('should throw error when building UPDATE without SET data', () => {
      expect(() => {
        sql.update('users').where('id = ?', 1).build()
      }).toThrow('SET data is required for UPDATE query')
    })

    it('should handle UPDATE with single field', () => {
      const result = sql
        .update('users')
        .set({ last_login: '2024-01-01' })
        .where('id = ?', 1)
        .build()
      
      expect(result.params).toEqual(['2024-01-01', 1])
    })
  })

  describe('DELETE queries', () => {
    it('should build a simple DELETE query', () => {
      const result = sql
        .delete('users')
        .where('id = ?', 1)
        .build()
      
      expect(result.sql).toBe('DELETE FROM "users" WHERE id = ?')
      expect(result.params).toEqual([1])
    })

    it('should build DELETE with multiple WHERE conditions', () => {
      const result = sql
        .delete('logs')
        .where('created_at < ?', '2023-01-01')
        .and('level = ?', 'debug')
        .build()
      
      expect(result.sql).toContain('WHERE created_at < ?')
      expect(result.sql).toContain('AND level = ?')
      expect(result.params).toEqual(['2023-01-01', 'debug'])
    })

    it('should build DELETE with OR condition', () => {
      const result = sql
        .delete('users')
        .where('status = ?', 'deleted')
        .or('status = ?', 'banned')
        .build()
      
      expect(result.sql).toContain('OR status = ?')
      expect(result.params).toEqual(['deleted', 'banned'])
    })

    it('should handle DELETE without WHERE clause', () => {
      const result = sql
        .delete('temp_data')
        .build()
      
      expect(result.sql).toBe('DELETE FROM "temp_data"')
      expect(result.params).toEqual([])
    })

    it('should handle DELETE with complex conditions', () => {
      const result = sql
        .delete('sessions')
        .where('expires_at < ?', Date.now())
        .and('user_id IS NULL')
        .build()
      
      expect(result.sql).toContain('WHERE expires_at < ?')
      expect(result.sql).toContain('AND user_id IS NULL')
    })

    it('should properly escape table name in DELETE', () => {
      const result = sql
        .delete('user_sessions')
        .where('id = ?', 1)
        .build()
      
      expect(result.sql).toContain('"user_sessions"')
    })
  })

  describe('RAW queries', () => {
    it('should build a raw SQL query', () => {
      const result = sql.raw('SELECT COUNT(*) FROM users').build()
      
      expect(result.sql).toBe('SELECT COUNT(*) FROM users')
      expect(result.params).toEqual([])
    })

    it('should handle raw query with custom SQL', () => {
      const result = sql.raw('TRUNCATE TABLE logs CASCADE').build()
      
      expect(result.sql).toBe('TRUNCATE TABLE logs CASCADE')
    })

    it('should handle empty raw query', () => {
      const result = sql.raw('').build()
      
      expect(result.sql).toBe('')
      expect(result.params).toEqual([])
    })
  })

  describe('Static table helper', () => {
    it('should create a SelectFromBuilder with table() helper', () => {
      const result = SQLQueryBuilder.table('users').build()
      
      expect(result.sql).toContain('FROM "users"')
    })

    it('should allow chaining methods with table() helper', () => {
      const result = SQLQueryBuilder.table('users')
        .where('active = ?', true)
        .limit(10)
        .build()
      
      expect(result.sql).toContain('WHERE active = ?')
      expect(result.sql).toContain('LIMIT 10')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle special characters in values', () => {
      const result = sql
        .insert('users')
        .values({ name: "O'Brien", email: 'test@example.com' })
        .build()
      
      expect(result.params).toContain("O'Brien")
    })

    it('should handle Unicode characters', () => {
      const result = sql
        .insert('users')
        .values({ name: '日本語', emoji: '🎉' })
        .build()
      
      expect(result.params).toContain('日本語')
      expect(result.params).toContain('🎉')
    })

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      const result = sql
        .insert('content')
        .values({ body: longString })
        .build()
      
      expect(result.params[0]).toHaveLength(10000)
    })

    it('should handle zero values', () => {
      const result = sql
        .insert('metrics')
        .values({ value: 0, count: 0 })
        .build()
      
      expect(result.params).toEqual([0, 0])
    })

    it('should handle negative numbers', () => {
      const result = sql
        .insert('transactions')
        .values({ amount: -50.5 })
        .build()
      
      expect(result.params).toContain(-50.5)
    })

    it('should handle empty strings', () => {
      const result = sql
        .insert('users')
        .values({ name: '', email: '' })
        .build()
      
      expect(result.params).toEqual(['', ''])
    })

    it('should handle whitespace-only values', () => {
      const result = sql
        .insert('content')
        .values({ text: '   ' })
        .build()
      
      expect(result.params).toContain('   ')
    })
  })

  describe('Parameter ordering', () => {
    it('should maintain correct parameter order in UPDATE', () => {
      const result = sql
        .update('users')
        .set({ name: 'John', age: 30, email: 'john@test.com' })
        .where('id = ?', 1)
        .build()
      
      // SET params should come before WHERE params
      expect(result.params.slice(0, 3)).toEqual(['John', 30, 'john@test.com'])
      expect(result.params[3]).toBe(1)
    })

    it('should maintain correct parameter order with multiple WHERE conditions', () => {
      const result = sql
        .select(['*'])
        .from('users')
        .where('age > ?', 18)
        .and('city = ?', 'NYC')
        .and('active = ?', true)
        .build()
      
      expect(result.params).toEqual([18, 'NYC', true])
    })
  })

  describe('SQL injection prevention', () => {
    it('should properly escape table names to prevent injection', () => {
      const result = sql.select(['*']).from('users').build()
      expect(result.sql).toContain('"users"')
    })

    it('should use parameterized queries for WHERE values', () => {
      const maliciousInput = "' OR '1'='1"
      const result = sql
        .select(['*'])
        .from('users')
        .where('username = ?', maliciousInput)
        .build()
      
      // Should be in params, not in SQL string
      expect(result.params).toContain(maliciousInput)
      expect(result.sql).not.toContain("OR '1'='1")
    })

    it('should use parameterized queries for INSERT values', () => {
      const result = sql
        .insert('users')
        .values({ name: "'; DROP TABLE users; --" })
        .build()
      
      expect(result.params).toContain("'; DROP TABLE users; --")
      expect(result.sql).not.toContain('DROP TABLE')
    })
  })
})
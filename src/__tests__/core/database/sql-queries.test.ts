/**
 * Comprehensive tests for sql-queries.ts
 * Tests functional SQL query builders with various scenarios
 */

import { describe, it, expect } from 'vitest'
import {
  selectAll,
  select,
  count,
  insert,
  update,
  deleteFrom,
  forTable,
  tablePreview,
  tableRowCount,
  describeTable,
  getPrimaryKeys,
  getForeignKeys,
} from '@/core/database/sql-queries'

describe('SQL Query Builders - Functional Approach', () => {
  describe('selectAll', () => {
    it('should generate a simple SELECT * query', () => {
      const query = selectAll('users')
      expect(query).toBe('SELECT * FROM "users";')
    })

    it('should generate SELECT * with schema', () => {
      const query = selectAll('users', { schema: 'public' })
      expect(query).toBe('SELECT * FROM "public"."users";')
    })

    it('should generate SELECT * with LIMIT', () => {
      const query = selectAll('users', { limit: 10 })
      expect(query).toBe('SELECT * FROM "users" LIMIT 10;')
    })

    it('should generate SELECT * with OFFSET', () => {
      const query = selectAll('users', { offset: 20 })
      expect(query).toBe('SELECT * FROM "users" OFFSET 20;')
    })

    it('should generate SELECT * with LIMIT and OFFSET', () => {
      const query = selectAll('users', { limit: 10, offset: 20 })
      expect(query).toBe('SELECT * FROM "users" LIMIT 10 OFFSET 20;')
    })

    it('should generate SELECT * with WHERE clause', () => {
      const query = selectAll('users', { where: 'age > 18' })
      expect(query).toBe('SELECT * FROM "users" WHERE age > 18;')
    })

    it('should generate SELECT * with ORDER BY ASC', () => {
      const query = selectAll('users', { orderBy: { column: 'name' } })
      expect(query).toBe('SELECT * FROM "users" ORDER BY "name" ASC;')
    })

    it('should generate SELECT * with ORDER BY DESC', () => {
      const query = selectAll('users', { orderBy: { column: 'created_at', direction: 'DESC' } })
      expect(query).toBe('SELECT * FROM "users" ORDER BY "created_at" DESC;')
    })

    it('should generate complex SELECT * with all options', () => {
      const query = selectAll('users', {
        schema: 'public',
        where: 'active = true',
        orderBy: { column: 'name', direction: 'ASC' },
        limit: 50,
        offset: 100,
      })
      
      expect(query).toContain('FROM "public"."users"')
      expect(query).toContain('WHERE active = true')
      expect(query).toContain('ORDER BY "name" ASC')
      expect(query).toContain('LIMIT 50')
      expect(query).toContain('OFFSET 100')
    })

    it('should escape table names with special characters', () => {
      const query = selectAll('user_profiles')
      expect(query).toContain('"user_profiles"')
    })

    it('should handle empty WHERE clause', () => {
      const query = selectAll('users', { where: '' })
      expect(query).not.toContain('WHERE')
    })
  })

  describe('select (specific columns)', () => {
    it('should generate SELECT with specific columns', () => {
      const query = select(['id', 'name', 'email'])('users')
      expect(query).toBe('SELECT "id", "name", "email" FROM "users";')
    })

    it('should generate SELECT with single column', () => {
      const query = select(['id'])('users')
      expect(query).toBe('SELECT "id" FROM "users";')
    })

    it('should generate SELECT with columns and schema', () => {
      const query = select(['id', 'name'])('users', { schema: 'public' })
      expect(query).toBe('SELECT "id", "name" FROM "public"."users";')
    })

    it('should generate SELECT with columns and WHERE', () => {
      const query = select(['id', 'name'])('users', { where: 'active = true' })
      expect(query).toBe('SELECT "id", "name" FROM "users" WHERE active = true;')
    })

    it('should generate SELECT with columns, ORDER BY, and LIMIT', () => {
      const query = select(['id', 'name'])('users', {
        orderBy: { column: 'name', direction: 'DESC' },
        limit: 5,
      })
      
      expect(query).toContain('ORDER BY "name" DESC')
      expect(query).toContain('LIMIT 5')
    })

    it('should escape column names', () => {
      const query = select(['user_id', 'first_name'])('users')
      expect(query).toContain('"user_id"')
      expect(query).toContain('"first_name"')
    })

    it('should handle empty columns array', () => {
      const query = select([])('users')
      expect(query).toContain('SELECT  FROM "users"')
    })

    it('should handle aggregate functions in column names', () => {
      const query = select(['COUNT(*) as count', 'MAX(age) as max_age'])('users')
      expect(query).toContain('COUNT(*) as count')
      expect(query).toContain('MAX(age) as max_age')
    })
  })

  describe('count', () => {
    it('should generate COUNT query', () => {
      const query = count('users')
      expect(query).toBe('SELECT COUNT(*) as count FROM "users";')
    })

    it('should generate COUNT with schema', () => {
      const query = count('users', { schema: 'public' })
      expect(query).toBe('SELECT COUNT(*) as count FROM "public"."users";')
    })

    it('should generate COUNT with WHERE clause', () => {
      const query = count('users', { where: 'active = true' })
      expect(query).toBe('SELECT COUNT(*) as count FROM "users" WHERE active = true;')
    })

    it('should generate COUNT with complex WHERE', () => {
      const query = count('orders', { where: "status = 'completed' AND total > 100" })
      expect(query).toContain("WHERE status = 'completed' AND total > 100")
    })

    it('should handle empty WHERE in COUNT', () => {
      const query = count('users', { where: '' })
      expect(query).not.toContain('WHERE')
    })
  })

  describe('insert', () => {
    it('should generate INSERT query with single value', () => {
      const result = insert('users')({ name: 'John' })
      
      expect(result.sql).toBe('INSERT INTO "users" ("name") VALUES ($1);')
      expect(result.values).toEqual(['John'])
    })

    it('should generate INSERT query with multiple values', () => {
      const result = insert('users')({
        name: 'John',
        email: 'john@example.com',
        age: 30,
      })
      
      expect(result.sql).toContain('INSERT INTO "users"')
      expect(result.sql).toContain('"name"')
      expect(result.sql).toContain('"email"')
      expect(result.sql).toContain('"age"')
      expect(result.sql).toContain('VALUES ($1, $2, $3)')
      expect(result.values).toEqual(['John', 'john@example.com', 30])
    })

    it('should generate INSERT with schema', () => {
      const result = insert('users', 'public')({ name: 'John' })
      
      expect(result.sql).toContain('"public"."users"')
    })

    it('should handle INSERT with null values', () => {
      const result = insert('users')({ name: 'John', description: null })
      
      expect(result.values).toContain(null)
    })

    it('should handle INSERT with boolean values', () => {
      const result = insert('users')({ name: 'John', active: true, verified: false })
      
      expect(result.values).toEqual(['John', true, false])
    })

    it('should handle INSERT with numeric values', () => {
      const result = insert('products')({ price: 99.99, stock: 50 })
      
      expect(result.values).toEqual([99.99, 50])
    })

    it('should handle INSERT with empty string', () => {
      const result = insert('users')({ name: '' })
      
      expect(result.values).toEqual([''])
    })

    it('should handle INSERT with special characters', () => {
      const result = insert('users')({ name: "O'Brien", bio: 'Test "quote"' })
      
      expect(result.values).toContain("O'Brien")
      expect(result.values).toContain('Test "quote"')
    })

    it('should handle INSERT with Unicode', () => {
      const result = insert('users')({ name: '日本語', emoji: '🎉' })
      
      expect(result.values).toEqual(['日本語', '🎉'])
    })

    it('should maintain correct parameter placeholders', () => {
      const result = insert('users')({ a: 1, b: 2, c: 3, d: 4, e: 5 })
      
      expect(result.sql).toContain('$1, $2, $3, $4, $5')
    })
  })

  describe('update', () => {
    it('should generate UPDATE query with single field', () => {
      const result = update('users')({ name: 'Jane' }, 'id = 1')
      
      expect(result.sql).toBe('UPDATE "users" SET "name" = $1 WHERE id = 1;')
      expect(result.values).toEqual(['Jane'])
    })

    it('should generate UPDATE with multiple fields', () => {
      const result = update('users')(
        { name: 'Jane', email: 'jane@example.com', age: 25 },
        'id = 1'
      )
      
      expect(result.sql).toContain('SET "name" = $1')
      expect(result.sql).toContain('"email" = $2')
      expect(result.sql).toContain('"age" = $3')
      expect(result.sql).toContain('WHERE id = 1')
      expect(result.values).toEqual(['Jane', 'jane@example.com', 25])
    })

    it('should generate UPDATE with schema', () => {
      const result = update('users', 'public')({ name: 'Jane' }, 'id = 1')
      
      expect(result.sql).toContain('"public"."users"')
    })

    it('should handle UPDATE with null values', () => {
      const result = update('users')({ description: null }, 'id = 1')
      
      expect(result.values).toContain(null)
    })

    it('should handle UPDATE with boolean values', () => {
      const result = update('users')({ active: false }, 'id = 1')
      
      expect(result.values).toEqual([false])
    })

    it('should handle UPDATE with complex WHERE', () => {
      const result = update('users')(
        { status: 'inactive' },
        "last_login < '2023-01-01' AND role = 'user'"
      )
      
      expect(result.sql).toContain("WHERE last_login < '2023-01-01' AND role = 'user'")
    })

    it('should handle UPDATE with zero values', () => {
      const result = update('products')({ stock: 0, price: 0 }, 'id = 1')
      
      expect(result.values).toEqual([0, 0])
    })

    it('should handle UPDATE with negative numbers', () => {
      const result = update('accounts')({ balance: -50.5 }, 'id = 1')
      
      expect(result.values).toEqual([-50.5])
    })
  })

  describe('deleteFrom', () => {
    it('should generate DELETE query', () => {
      const query = deleteFrom('users')('id = 1')
      
      expect(query).toBe('DELETE FROM "users" WHERE id = 1;')
    })

    it('should generate DELETE with schema', () => {
      const query = deleteFrom('users', 'public')('id = 1')
      
      expect(query).toBe('DELETE FROM "public"."users" WHERE id = 1;')
    })

    it('should handle DELETE with complex WHERE', () => {
      const query = deleteFrom('logs')("created_at < '2023-01-01' AND level = 'debug'")
      
      expect(query).toContain('WHERE')
      expect(query).toContain("created_at < '2023-01-01'")
    })

    it('should handle DELETE with OR conditions', () => {
      const query = deleteFrom('users')("status = 'deleted' OR status = 'banned'")
      
      expect(query).toContain('OR')
    })

    it('should escape table names in DELETE', () => {
      const query = deleteFrom('user_sessions')('id = 1')
      
      expect(query).toContain('"user_sessions"')
    })
  })

  describe('forTable (curried helpers)', () => {
    it('should create table-scoped selectAll', () => {
      const usersTable = forTable('users')
      const query = usersTable.selectAll()
      
      expect(query).toBe('SELECT * FROM "users";')
    })

    it('should create table-scoped selectAll with options', () => {
      const usersTable = forTable('users', 'public')
      const query = usersTable.selectAll({ limit: 10, where: 'active = true' })
      
      expect(query).toContain('"public"."users"')
      expect(query).toContain('WHERE active = true')
      expect(query).toContain('LIMIT 10')
    })

    it('should create table-scoped select', () => {
      const usersTable = forTable('users')
      const query = usersTable.select(['id', 'name'])
      
      expect(query).toBe('SELECT "id", "name" FROM "users";')
    })

    it('should create table-scoped count', () => {
      const usersTable = forTable('users', 'public')
      const query = usersTable.count()
      
      expect(query).toBe('SELECT COUNT(*) as count FROM "public"."users";')
    })

    it('should create table-scoped count with WHERE', () => {
      const usersTable = forTable('users')
      const query = usersTable.count('age > 18')
      
      expect(query).toContain('WHERE age > 18')
    })

    it('should create table-scoped insert', () => {
      const usersTable = forTable('users')
      const result = usersTable.insert({ name: 'John' })
      
      expect(result.sql).toContain('INSERT INTO "users"')
      expect(result.values).toEqual(['John'])
    })

    it('should create table-scoped update', () => {
      const usersTable = forTable('users', 'public')
      const result = usersTable.update({ name: 'Jane' }, 'id = 1')
      
      expect(result.sql).toContain('"public"."users"')
      expect(result.values).toEqual(['Jane'])
    })

    it('should create table-scoped delete', () => {
      const usersTable = forTable('users')
      const query = usersTable.delete('id = 1')
      
      expect(query).toBe('DELETE FROM "users" WHERE id = 1;')
    })
  })

  describe('Prebuilt common queries', () => {
    it('should generate table preview query', () => {
      const query = tablePreview('users')
      
      expect(query).toBe('SELECT * FROM "users" LIMIT 100;')
    })

    it('should generate table preview with custom limit', () => {
      const query = tablePreview('users', undefined, 50)
      
      expect(query).toBe('SELECT * FROM "users" LIMIT 50;')
    })

    it('should generate table preview with schema', () => {
      const query = tablePreview('users', 'public', 25)
      
      expect(query).toBe('SELECT * FROM "public"."users" LIMIT 25;')
    })

    it('should generate table row count query', () => {
      const query = tableRowCount('users')
      
      expect(query).toBe('SELECT COUNT(*) as count FROM "users";')
    })

    it('should generate table row count with schema', () => {
      const query = tableRowCount('users', 'public')
      
      expect(query).toBe('SELECT COUNT(*) as count FROM "public"."users";')
    })
  })

  describe('Postgres introspection queries', () => {
    it('should generate describeTable query', () => {
      const query = describeTable('users')
      
      expect(query).toContain('information_schema.columns')
      expect(query).toContain("table_name = 'users'")
      expect(query).toContain('column_name')
      expect(query).toContain('data_type')
      expect(query).toContain('is_nullable')
    })

    it('should generate describeTable with schema', () => {
      const query = describeTable('users', 'public')
      
      expect(query).toContain("table_name = 'users'")
      expect(query).toContain("table_schema = 'public'")
    })

    it('should generate getPrimaryKeys query', () => {
      const query = getPrimaryKeys('users')
      
      expect(query).toContain('information_schema.table_constraints')
      expect(query).toContain("table_name = 'users'")
      expect(query).toContain("constraint_type = 'PRIMARY KEY'")
    })

    it('should generate getPrimaryKeys with schema', () => {
      const query = getPrimaryKeys('users', 'public')
      
      expect(query).toContain("table_name = 'users'")
      expect(query).toContain("table_schema = 'public'")
    })

    it('should generate getForeignKeys query', () => {
      const query = getForeignKeys('orders')
      
      expect(query).toContain('information_schema.table_constraints')
      expect(query).toContain("table_name = 'orders'")
      expect(query).toContain("constraint_type = 'FOREIGN KEY'")
      expect(query).toContain('foreign_table_name')
      expect(query).toContain('foreign_column_name')
    })

    it('should generate getForeignKeys with schema', () => {
      const query = getForeignKeys('orders', 'public')
      
      expect(query).toContain("table_name = 'orders'")
      expect(query).toContain("table_schema = 'public'")
    })
  })

  describe('Edge cases and special characters', () => {
    it('should handle table names with underscores', () => {
      const query = selectAll('user_profiles')
      expect(query).toContain('"user_profiles"')
    })

    it('should handle schema names with underscores', () => {
      const query = selectAll('users', { schema: 'my_schema' })
      expect(query).toContain('"my_schema"')
    })

    it('should handle column names with special characters', () => {
      const query = select(['user_id', 'first_name', 'last_name'])('users')
      expect(query).toContain('"user_id"')
      expect(query).toContain('"first_name"')
    })

    it('should handle WHERE with complex SQL', () => {
      const query = selectAll('users', {
        where: "age BETWEEN 18 AND 65 AND status IN ('active', 'pending')",
      })
      expect(query).toContain('BETWEEN')
      expect(query).toContain('IN')
    })

    it('should handle ORDER BY with multiple columns in WHERE', () => {
      const query = selectAll('users', {
        where: 'active = true',
        orderBy: { column: 'created_at', direction: 'DESC' },
      })
      expect(query).toContain('WHERE active = true')
      expect(query).toContain('ORDER BY "created_at" DESC')
    })

    it('should handle empty options object', () => {
      const query = selectAll('users', {})
      expect(query).toBe('SELECT * FROM "users";')
    })
  })

  describe('SQL injection prevention', () => {
    it('should escape table names', () => {
      const query = selectAll('users')
      expect(query).toContain('"users"')
    })

    it('should escape column names', () => {
      const query = select(['id', 'name'])('users')
      expect(query).toContain('"id"')
      expect(query).toContain('"name"')
    })

    it('should escape schema names', () => {
      const query = selectAll('users', { schema: 'public' })
      expect(query).toContain('"public"')
    })

    it('should use parameterized queries for INSERT values', () => {
      const maliciousValue = "'; DROP TABLE users; --"
      const result = insert('users')({ name: maliciousValue })
      
      // Should be in values array, not in SQL string
      expect(result.values).toContain(maliciousValue)
      expect(result.sql).not.toContain('DROP TABLE')
    })

    it('should use parameterized queries for UPDATE values', () => {
      const maliciousValue = "test'; DELETE FROM users; --"
      const result = update('users')({ bio: maliciousValue }, 'id = 1')
      
      expect(result.values).toContain(maliciousValue)
      expect(result.sql).not.toContain('DELETE FROM')
    })
  })
})
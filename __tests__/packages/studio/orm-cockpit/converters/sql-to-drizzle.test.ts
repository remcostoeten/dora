import { describe, expect, it } from 'vitest'
import { convertSqlToDrizzle } from '@studio/features/orm-cockpit/converters/sql-to-drizzle'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'
import type { SchemaIR } from '@studio/features/orm-cockpit/ir/types'
import type { ConvertResult, SqlToDrizzle } from '@studio/features/orm-cockpit/converters/contract'
import { SQL_TO_DRIZZLE_FIXTURES } from './fixtures/sql-to-drizzle-fixtures'

const IMPLEMENTS_CONTRACT: SqlToDrizzle = convertSqlToDrizzle

function expectOk(result: ConvertResult): Extract<ConvertResult, { ok: true }> {
	if (!result.ok) {
		throw new Error(`expected success, got ${JSON.stringify(result.errors)}`)
	}
	return result
}

function expectFailure(result: ConvertResult): Extract<ConvertResult, { ok: false }> {
	if (result.ok) {
		throw new Error(`expected failure, got:\n${result.output}`)
	}
	return result
}

describe('convertSqlToDrizzle: contract surface', function () {
	it('satisfies the SqlToDrizzle signature', function () {
		expect(IMPLEMENTS_CONTRACT).toBe(convertSqlToDrizzle)
	})

	it('rejects an unknown dialect', function () {
		const result = expectFailure(
			convertSqlToDrizzle('SELECT * FROM users', { dialect: 'oracle' as never })
		)
		expect(result.errors[0].code).toBe('unsupported-dialect')
	})

	it('rejects empty and comment-only input', function () {
		expect(
			expectFailure(convertSqlToDrizzle('   \n\t', { dialect: 'postgres' })).errors[0].code
		).toBe('empty-input')
		expect(
			expectFailure(
				convertSqlToDrizzle('-- nothing here\n/* or here */', { dialect: 'postgres' })
			).errors[0].code
		).toBe('empty-input')
	})

	it('auto-detects the schema surface from DDL and the query surface from DML', function () {
		expect(
			expectOk(
				convertSqlToDrizzle('CREATE TABLE t (id INTEGER PRIMARY KEY);', {
					dialect: 'sqlite'
				})
			).surface
		).toBe('schema')
		expect(
			expectOk(convertSqlToDrizzle('SELECT * FROM t', { dialect: 'sqlite' })).surface
		).toBe('query')
		expect(
			expectOk(convertSqlToDrizzle('DELETE FROM t WHERE id = 1', { dialect: 'sqlite' }))
				.surface
		).toBe('query')
	})

	it('honours a pinned surface', function () {
		const result = expectFailure(
			convertSqlToDrizzle('CREATE TABLE t (id INTEGER PRIMARY KEY);', {
				dialect: 'sqlite',
				surface: 'query'
			})
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('SELECT, INSERT, UPDATE or DELETE')
	})

	it('never throws on garbage input', function () {
		const result = expectFailure(
			convertSqlToDrizzle('%%% not sql %%%', { dialect: 'postgres' })
		)
		expect(result.errors[0].code).toBe('parse-error')
	})

	it('is deterministic: the same input and options give byte-identical output', function () {
		for (const fixture of SQL_TO_DRIZZLE_FIXTURES) {
			const first = expectOk(convertSqlToDrizzle(fixture.sql, { dialect: fixture.dialect }))
			const second = expectOk(convertSqlToDrizzle(fixture.sql, { dialect: fixture.dialect }))
			expect(second.output).toBe(first.output)
			expect(second.warnings).toEqual(first.warnings)
		}
	})
})

describe('convertSqlToDrizzle: fixtures', function () {
	for (const fixture of SQL_TO_DRIZZLE_FIXTURES) {
		it(fixture.name, function () {
			const result = expectOk(convertSqlToDrizzle(fixture.sql, { dialect: fixture.dialect }))
			expect(result.output).toBe(fixture.drizzle)
			expect(result.warnings).toEqual(fixture.warnings ?? [])
		})
	}
})

describe('convertSqlToDrizzle: emitted style', function () {
	it('indents with tabs and never emits semicolons', function () {
		for (const fixture of SQL_TO_DRIZZLE_FIXTURES) {
			expect(fixture.drizzle).not.toMatch(/^ +/m)
			expect(fixture.drizzle).not.toMatch(/;\s*$/m)
		}
	})
})

// ---------------------------------------------------------------------------
// Schema round trip: DDL → Drizzle → parseDrizzleSchema → SchemaIR
// ---------------------------------------------------------------------------

const ROUND_TRIP_DDL = `
CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	full_name TEXT,
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	balance NUMERIC(10,2) DEFAULT 0,
	role TEXT DEFAULT 'member',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
	id SERIAL PRIMARY KEY,
	title VARCHAR(200) NOT NULL,
	author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	published_at TIMESTAMP
);

CREATE INDEX posts_author_id_idx ON posts (author_id);

CREATE TABLE post_tags (
	post_id INTEGER NOT NULL,
	tag TEXT NOT NULL,
	PRIMARY KEY (post_id, tag)
);
`

const EXPECTED_IR: SchemaIR = {
	dialect: 'postgres',
	tables: [
		{
			name: 'post_tags',
			schema: 'public',
			columns: [
				{
					name: 'post_id',
					type: 'int',
					rawType: 'integer',
					typeParams: undefined,
					nullable: false,
					default: null,
					autoIncrement: false
				},
				{
					name: 'tag',
					type: 'text',
					rawType: 'text',
					typeParams: undefined,
					nullable: false,
					default: null,
					autoIncrement: false
				}
			],
			primaryKey: ['post_id', 'tag'],
			indexes: [],
			foreignKeys: []
		},
		{
			name: 'posts',
			schema: 'public',
			columns: [
				{
					name: 'author_id',
					type: 'int',
					rawType: 'integer',
					typeParams: undefined,
					nullable: false,
					default: null,
					autoIncrement: false
				},
				{
					name: 'id',
					type: 'int',
					rawType: 'serial',
					typeParams: undefined,
					nullable: false,
					default: null,
					autoIncrement: true
				},
				{
					name: 'published_at',
					type: 'timestamp',
					rawType: 'timestamp',
					typeParams: undefined,
					nullable: true,
					default: null,
					autoIncrement: false
				},
				{
					name: 'title',
					type: 'varchar',
					rawType: 'varchar',
					typeParams: '200',
					nullable: false,
					default: null,
					autoIncrement: false
				}
			],
			primaryKey: ['id'],
			indexes: [{ name: 'posts_author_id_idx', columns: ['author_id'], unique: false }],
			foreignKeys: [
				{
					columns: ['author_id'],
					refTable: 'users',
					refColumns: ['id'],
					onDelete: 'cascade'
				}
			]
		},
		{
			name: 'users',
			schema: 'public',
			columns: [
				{
					name: 'balance',
					type: 'decimal',
					rawType: 'numeric',
					typeParams: '10,2',
					nullable: true,
					default: '0',
					autoIncrement: false
				},
				{
					name: 'created_at',
					type: 'timestamp',
					rawType: 'timestamp',
					typeParams: undefined,
					nullable: true,
					default: 'now()',
					autoIncrement: false
				},
				{
					name: 'email',
					type: 'varchar',
					rawType: 'varchar',
					typeParams: '255',
					nullable: false,
					default: null,
					autoIncrement: false
				},
				{
					name: 'full_name',
					type: 'text',
					rawType: 'text',
					typeParams: undefined,
					nullable: true,
					default: null,
					autoIncrement: false
				},
				{
					name: 'id',
					type: 'int',
					rawType: 'serial',
					typeParams: undefined,
					nullable: false,
					default: null,
					autoIncrement: true
				},
				{
					name: 'is_active',
					type: 'bool',
					rawType: 'boolean',
					typeParams: undefined,
					nullable: false,
					default: 'true',
					autoIncrement: false
				},
				{
					name: 'role',
					type: 'text',
					rawType: 'text',
					typeParams: undefined,
					nullable: true,
					default: 'member',
					autoIncrement: false
				}
			],
			primaryKey: ['id'],
			indexes: [{ name: 'users_email_unique', columns: ['email'], unique: true }],
			foreignKeys: []
		}
	]
}

describe('convertSqlToDrizzle: schema round trip', function () {
	const converted = expectOk(convertSqlToDrizzle(ROUND_TRIP_DDL, { dialect: 'postgres' }))
	const reparsed = parseDrizzleSchema([{ path: 'schema.ts', text: converted.output }], 'postgres')

	it('emits code the Drizzle parser fully understands', function () {
		expect(reparsed.warnings).toEqual([])
	})

	it('reproduces the schema the DDL described', function () {
		expect(reparsed.ir).toEqual(EXPECTED_IR)
	})

	it('declares referenced tables before the tables that reference them', function () {
		expect(converted.output.indexOf('export const users')).toBeLessThan(
			converted.output.indexOf('export const posts')
		)
	})

	it('round-trips a mysql schema too', function () {
		const mysql = expectOk(
			convertSqlToDrizzle(
				[
					'CREATE TABLE accounts (',
					'\tid INT NOT NULL AUTO_INCREMENT,',
					'\tlogin VARCHAR(120) NOT NULL,',
					'\tverified TINYINT(1) NOT NULL DEFAULT 0,',
					'\tPRIMARY KEY (id),',
					'\tUNIQUE KEY accounts_login_unique (login)',
					');'
				].join('\n'),
				{ dialect: 'mysql' }
			)
		)
		const parsed = parseDrizzleSchema([{ path: 'schema.ts', text: mysql.output }], 'mysql')
		expect(parsed.warnings).toEqual([])
		expect(parsed.ir.tables[0].primaryKey).toEqual(['id'])
		expect(parsed.ir.tables[0].indexes).toEqual([
			{ name: 'accounts_login_unique', columns: ['login'], unique: true }
		])
		expect(parsed.ir.tables[0].columns.map((column) => column.autoIncrement)).toEqual([
			true,
			false,
			false
		])
	})

	it('round-trips a sqlite schema too', function () {
		const sqlite = expectOk(
			convertSqlToDrizzle(
				[
					'CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL);',
					'CREATE TABLE books (',
					'\tid INTEGER PRIMARY KEY,',
					'\tauthor_id INTEGER NOT NULL REFERENCES authors (id) ON DELETE CASCADE',
					');'
				].join('\n'),
				{ dialect: 'sqlite' }
			)
		)
		const parsed = parseDrizzleSchema([{ path: 'schema.ts', text: sqlite.output }], 'sqlite')
		expect(parsed.warnings).toEqual([])
		expect(parsed.ir.tables.map((table) => table.name)).toEqual(['authors', 'books'])
		expect(parsed.ir.tables[1].foreignKeys).toEqual([
			{ columns: ['author_id'], refTable: 'authors', refColumns: ['id'], onDelete: 'cascade' }
		])
	})
})

// ---------------------------------------------------------------------------
// Warnings and errors
// ---------------------------------------------------------------------------

describe('convertSqlToDrizzle: severable warnings', function () {
	it('degrades an unknown column type to text() rather than failing', function () {
		const result = expectOk(
			convertSqlToDrizzle('CREATE TABLE odd (id INTEGER PRIMARY KEY, shape GEOMETRY);', {
				dialect: 'sqlite'
			})
		)
		expect(result.output).toContain('shape: text()')
		expect(result.warnings[0]).toContain('no Drizzle builder')
	})

	it('drops CHECK constraints with a note', function () {
		const result = expectOk(
			convertSqlToDrizzle(
				'CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER CHECK (n > 0));',
				{
					dialect: 'sqlite'
				}
			)
		)
		expect(result.warnings.join('\n')).toContain('CHECK constraint')
	})

	it('drops a partial-index predicate with a note', function () {
		const result = expectOk(
			convertSqlToDrizzle(
				'CREATE TABLE t (id INTEGER PRIMARY KEY, live INTEGER);\nCREATE INDEX t_live_idx ON t (live) WHERE live = 1;',
				{ dialect: 'sqlite' }
			)
		)
		expect(result.warnings.join('\n')).toContain('partial-index predicate')
	})

	it('notes that a table alias is resolved to the table export', function () {
		const result = expectOk(
			convertSqlToDrizzle('SELECT u.id FROM users u WHERE u.id = 1', { dialect: 'postgres' })
		)
		expect(result.output).toContain('db.select({ id: users.id }).from(users)')
		expect(result.warnings[0]).toContain('table alias "u"')
	})

	it('converts only the first of several DML statements', function () {
		const result = expectOk(
			convertSqlToDrizzle('DELETE FROM users WHERE id = 1; DELETE FROM posts WHERE id = 2;', {
				dialect: 'postgres'
			})
		)
		expect(result.output).toContain('db.delete(users)')
		expect(result.output).not.toContain('posts')
		expect(result.warnings.join('\n')).toContain('one statement at a time')
	})

	it('warns that MySQL has no RETURNING clause', function () {
		const result = expectOk(
			convertSqlToDrizzle("INSERT INTO t (a) VALUES ('x') RETURNING *", { dialect: 'mysql' })
		)
		expect(result.warnings.join('\n')).toContain('MySQL has no RETURNING')
	})
})

describe('convertSqlToDrizzle: unsupported constructs', function () {
	const CASES: { name: string; sql: string; needle: string }[] = [
		{ name: 'HAVING', sql: 'SELECT id FROM t GROUP BY id HAVING id > 1', needle: 'HAVING' },
		{
			name: 'window functions',
			sql: 'SELECT row_number() OVER (ORDER BY id) FROM t',
			needle: 'window functions'
		},
		{
			name: 'CTEs',
			sql: 'WITH x AS (SELECT 1) SELECT * FROM x',
			needle: 'common table expressions'
		},
		{ name: 'UNION', sql: 'SELECT id FROM a UNION SELECT id FROM b', needle: 'UNION' },
		{
			name: 'aggregate in the select list',
			sql: 'SELECT count(*) FROM t',
			needle: 'function calls in the select list'
		},
		{ name: 'SELECT DISTINCT', sql: 'SELECT DISTINCT id FROM t', needle: 'DISTINCT' },
		{ name: 'column aliases', sql: 'SELECT id AS pk FROM t', needle: 'aliases' },
		{ name: 'CROSS JOIN', sql: 'SELECT * FROM a CROSS JOIN b', needle: 'CROSS JOIN' },
		{
			name: 'subqueries in FROM',
			sql: 'SELECT * FROM (SELECT 1) x',
			needle: 'subqueries in FROM'
		},
		{
			name: 'IN (SELECT …)',
			sql: 'SELECT * FROM a WHERE id IN (SELECT id FROM b)',
			needle: 'IN (SELECT'
		},
		{
			name: 'INSERT without a column list',
			sql: "INSERT INTO t VALUES (1, 'x')",
			needle: 'explicit column list'
		},
		{
			name: 'ON CONFLICT',
			sql: 'INSERT INTO t (a) VALUES (1) ON CONFLICT DO NOTHING',
			needle: 'ON CONFLICT'
		},
		{
			name: 'INSERT ... SELECT',
			sql: 'INSERT INTO t (a) SELECT a FROM u',
			needle: 'INSERT ... SELECT'
		},
		{ name: 'UPDATE ... FROM', sql: 'UPDATE t SET a = 1 FROM u', needle: 'UPDATE ... FROM' },
		{ name: 'CREATE VIEW', sql: 'CREATE VIEW v AS SELECT 1', needle: 'CREATE VIEW' },
		{
			name: 'ALTER TABLE DROP',
			sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY);\nALTER TABLE t DROP COLUMN id;',
			needle: 'ALTER TABLE'
		},
		{
			name: 'expression indexes',
			sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, a TEXT);\nCREATE INDEX i ON t (lower(a));',
			needle: 'expression indexes'
		},
		{
			name: 'generated columns',
			sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, a INTEGER GENERATED ALWAYS AS (id + 1) STORED);',
			needle: 'GENERATED'
		}
	]

	for (const item of CASES) {
		it(`reports ${item.name}`, function () {
			const result = expectFailure(convertSqlToDrizzle(item.sql, { dialect: 'postgres' }))
			expect(result.errors[0].code).toBe('unsupported-construct')
			expect(result.errors[0].message).toContain(item.needle)
		})
	}
})

describe('convertSqlToDrizzle: parse errors', function () {
	it('reports a missing closing paren with a line number', function () {
		const result = expectFailure(
			convertSqlToDrizzle('CREATE TABLE t (\n\tid INTEGER PRIMARY KEY,\n\tname TEXT\n', {
				dialect: 'sqlite'
			})
		)
		expect(result.errors[0].code).toBe('parse-error')
		expect(result.errors[0].line).toBe(4)
	})

	it('reports an unterminated string with the line it opened on', function () {
		const result = expectFailure(
			convertSqlToDrizzle("SELECT * FROM t WHERE a = 'oops", { dialect: 'sqlite' })
		)
		expect(result.errors[0].code).toBe('parse-error')
		expect(result.errors[0].message).toContain('unterminated string')
		expect(result.errors[0].line).toBe(1)
	})

	it('reports a CREATE INDEX on a table the script never creates', function () {
		const result = expectFailure(
			convertSqlToDrizzle(
				'CREATE TABLE a (id INTEGER PRIMARY KEY);\nCREATE INDEX i ON b (id);',
				{
					dialect: 'sqlite'
				}
			)
		)
		expect(result.errors[0].code).toBe('parse-error')
		expect(result.errors[0].message).toContain('unknown table "b"')
	})

	it('reports an unknown table qualifier in a query', function () {
		const result = expectFailure(
			convertSqlToDrizzle('SELECT * FROM users WHERE x.id = 1', { dialect: 'postgres' })
		)
		expect(result.errors[0].code).toBe('parse-error')
		expect(result.errors[0].message).toContain('unknown table or alias "x"')
	})
})

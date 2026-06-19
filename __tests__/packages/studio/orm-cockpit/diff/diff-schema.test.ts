import { describe, expect, it } from 'vitest'
import type {
	ColumnIR,
	ForeignKeyIR,
	IndexIR,
	NormalizedType,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'

// ---- fixture builders ------------------------------------------------------

function col(name: string, type: NormalizedType, over: Partial<ColumnIR> = {}): ColumnIR {
	return {
		name,
		type,
		rawType: over.rawType ?? type,
		nullable: over.nullable ?? false,
		default: over.default ?? null,
		autoIncrement: over.autoIncrement ?? false,
	}
}

function table(name: string, columns: ColumnIR[], over: Partial<TableIR> = {}): TableIR {
	return {
		name,
		columns,
		primaryKey: over.primaryKey ?? [],
		indexes: over.indexes ?? [],
		foreignKeys: over.foreignKeys ?? [],
		...(over.schema !== undefined ? { schema: over.schema } : {}),
	}
}

function schema(tables: TableIR[]): SchemaIR {
	return { dialect: 'postgres', tables }
}

const idCol = col('id', 'int', { autoIncrement: true })

// ---- identical -------------------------------------------------------------

describe('diffSchema — identical', function () {
	it('returns no changes for structurally identical schemas', function () {
		const a = schema([table('user', [idCol, col('name', 'text')])])
		const b = schema([table('user', [idCol, col('name', 'text')])])
		const diff = diffSchema(a, b)
		expect(diff.hasChanges).toBe(false)
		expect(diff.tables).toEqual([])
	})

	it('does not flag a column when only rawType differs but normalized type is equal', function () {
		const a = schema([table('t', [col('c', 'varchar', { rawType: 'varchar(255)' })])])
		const b = schema([table('t', [col('c', 'varchar', { rawType: 'character varying(255)' })])])
		const diff = diffSchema(a, b)
		expect(diff.hasChanges).toBe(false)
	})
})

// ---- table add / remove ----------------------------------------------------

describe('diffSchema — tables added / removed', function () {
	it('marks a table only in `to` as added + safe', function () {
		const from = schema([])
		const to = schema([table('user', [idCol])])
		const diff = diffSchema(from, to)
		expect(diff.hasChanges).toBe(true)
		expect(diff.tables).toHaveLength(1)
		expect(diff.tables[0].kind).toBe('added')
		expect(diff.tables[0].confidence).toBe('safe')
		expect(diff.tables[0].columns.every((c) => c.kind === 'added')).toBe(true)
	})

	it('marks a table only in `from` as removed + destructive', function () {
		const from = schema([table('user', [idCol])])
		const to = schema([])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].kind).toBe('removed')
		expect(diff.tables[0].confidence).toBe('destructive')
		expect(diff.tables[0].columns[0].kind).toBe('removed')
	})

	it('keeps added-table confidence safe even with a NOT NULL no-default column', function () {
		// Whole-table CREATE carries the columns inline; the table verdict is safe.
		const to = schema([table('user', [idCol, col('email', 'text')])])
		const diff = diffSchema(schema([]), to)
		expect(diff.tables[0].confidence).toBe('safe')
	})
})

// ---- column add / remove ---------------------------------------------------

describe('diffSchema — columns added / removed', function () {
	it('adding a nullable column is safe', function () {
		const from = schema([table('t', [idCol])])
		const to = schema([table('t', [idCol, col('bio', 'text', { nullable: true })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns.find((x) => x.name === 'bio')!
		expect(c.kind).toBe('added')
		expect(c.confidence).toBe('safe')
	})

	it('adding a NOT NULL column with a default is safe', function () {
		const from = schema([table('t', [idCol])])
		const to = schema([table('t', [idCol, col('active', 'bool', { default: 'true' })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns.find((x) => x.name === 'active')!
		expect(c.confidence).toBe('safe')
	})

	it('adding a NOT NULL column without a default is destructive', function () {
		const from = schema([table('t', [idCol])])
		const to = schema([table('t', [idCol, col('email', 'text')])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns.find((x) => x.name === 'email')!
		expect(c.kind).toBe('added')
		expect(c.confidence).toBe('destructive')
		// the table inherits worst-of children
		expect(diff.tables[0].confidence).toBe('destructive')
	})

	it('removing a column is destructive', function () {
		const from = schema([table('t', [idCol, col('legacy', 'text', { nullable: true })])])
		const to = schema([table('t', [idCol])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns.find((x) => x.name === 'legacy')!
		expect(c.kind).toBe('removed')
		expect(c.confidence).toBe('destructive')
	})
})

// ---- per-field column changes ----------------------------------------------

describe('diffSchema — column field changes', function () {
	it('flags nullable change (NOT NULL -> nullable) as safe relaxation', function () {
		const from = schema([table('t', [col('c', 'text', { nullable: false })])])
		const to = schema([table('t', [col('c', 'text', { nullable: true })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toEqual(['nullable'])
		expect(c.confidence).toBe('safe')
	})

	it('flags nullable change (nullable -> NOT NULL) as review', function () {
		const from = schema([table('t', [col('c', 'text', { nullable: true })])])
		const to = schema([table('t', [col('c', 'text', { nullable: false })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toEqual(['nullable'])
		expect(c.confidence).toBe('review')
	})

	it('flags default change as review', function () {
		const from = schema([table('t', [col('c', 'int', { default: '0' })])])
		const to = schema([table('t', [col('c', 'int', { default: '1' })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toEqual(['default'])
		expect(c.confidence).toBe('review')
	})

	it('flags autoIncrement change as review', function () {
		const from = schema([table('t', [col('c', 'int', { autoIncrement: false })])])
		const to = schema([table('t', [col('c', 'int', { autoIncrement: true })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toEqual(['autoIncrement'])
		expect(c.confidence).toBe('review')
	})

	it('records multiple changed fields together', function () {
		const from = schema([table('t', [col('c', 'int', { nullable: true, default: '0' })])])
		const to = schema([table('t', [col('c', 'int', { nullable: false, default: '1' })])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toEqual(['nullable', 'default'])
		expect(c.confidence).toBe('review')
	})
})

// ---- type changes ----------------------------------------------------------

describe('diffSchema — type changes', function () {
	it('narrowing numeric type (bigint -> int) is destructive', function () {
		const from = schema([table('t', [col('c', 'bigint')])])
		const to = schema([table('t', [col('c', 'int')])])
		const diff = diffSchema(from, to)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toContain('type')
		expect(c.confidence).toBe('destructive')
	})

	it('widening numeric type (int -> bigint) is review', function () {
		const from = schema([table('t', [col('c', 'int')])])
		const to = schema([table('t', [col('c', 'bigint')])])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].columns[0].confidence).toBe('review')
	})

	it('non-numeric type change (text -> timestamp) is review', function () {
		const from = schema([table('t', [col('c', 'text')])])
		const to = schema([table('t', [col('c', 'timestamp')])])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].columns[0].confidence).toBe('review')
	})

	it('unknown type with differing rawType is at least review (never equal)', function () {
		const from = schema([table('t', [col('c', 'unknown', { rawType: 'citext' })])])
		const to = schema([table('t', [col('c', 'unknown', { rawType: 'hstore' })])])
		const diff = diffSchema(from, to)
		expect(diff.hasChanges).toBe(true)
		const c = diff.tables[0].columns[0]
		expect(c.changedFields).toContain('type')
		expect(c.confidence).toBe('review')
	})

	it('unknown type with identical rawType is treated as equal', function () {
		const from = schema([table('t', [col('c', 'unknown', { rawType: 'citext' })])])
		const to = schema([table('t', [col('c', 'unknown', { rawType: 'citext' })])])
		const diff = diffSchema(from, to)
		expect(diff.hasChanges).toBe(false)
	})

	it('known -> unknown type change is review', function () {
		const from = schema([table('t', [col('c', 'text', { rawType: 'text' })])])
		const to = schema([table('t', [col('c', 'unknown', { rawType: 'geometry' })])])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].columns[0].confidence).toBe('review')
	})
})

// ---- indexes ---------------------------------------------------------------

describe('diffSchema — indexes', function () {
	function idx(name: string, columns: string[], unique = false): IndexIR {
		return { name, columns, unique }
	}

	it('added index is a safe-contributing Change', function () {
		const from = schema([table('t', [idCol])])
		const to = schema([table('t', [idCol], { indexes: [idx('t_id_idx', ['id'])] })])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].indexes).toEqual([
			{ kind: 'added', after: idx('t_id_idx', ['id']) },
		])
		expect(diff.tables[0].confidence).toBe('safe')
	})

	it('removed index contributes review', function () {
		const from = schema([table('t', [idCol], { indexes: [idx('t_id_idx', ['id'])] })])
		const to = schema([table('t', [idCol])])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].indexes[0].kind).toBe('removed')
		expect(diff.tables[0].confidence).toBe('review')
	})

	it('changed index (unique toggle) emits a changed Change', function () {
		const from = schema([table('t', [idCol], { indexes: [idx('t_id_idx', ['id'], false)] })])
		const to = schema([table('t', [idCol], { indexes: [idx('t_id_idx', ['id'], true)] })])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].indexes[0].kind).toBe('changed')
		expect(diff.tables[0].indexes[0].before!.unique).toBe(false)
		expect(diff.tables[0].indexes[0].after!.unique).toBe(true)
	})
})

// ---- foreign keys ----------------------------------------------------------

describe('diffSchema — foreign keys', function () {
	function fk(columns: string[], refTable: string, refColumns: string[], over: Partial<ForeignKeyIR> = {}): ForeignKeyIR {
		return { columns, refTable, refColumns, ...over }
	}

	it('added FK emits an added Change (review)', function () {
		const from = schema([table('post', [idCol, col('author_id', 'int')])])
		const to = schema([
			table('post', [idCol, col('author_id', 'int')], {
				foreignKeys: [fk(['author_id'], 'user', ['id'])],
			}),
		])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].foreignKeys[0].kind).toBe('added')
		expect(diff.tables[0].confidence).toBe('review')
	})

	it('removed FK emits a removed Change', function () {
		const from = schema([
			table('post', [idCol, col('author_id', 'int')], {
				foreignKeys: [fk(['author_id'], 'user', ['id'])],
			}),
		])
		const to = schema([table('post', [idCol, col('author_id', 'int')])])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].foreignKeys[0].kind).toBe('removed')
	})

	it('changed FK (onDelete differs, same columns+refTable) emits a changed Change', function () {
		const from = schema([
			table('post', [idCol, col('author_id', 'int')], {
				foreignKeys: [fk(['author_id'], 'user', ['id'], { onDelete: 'cascade' })],
			}),
		])
		const to = schema([
			table('post', [idCol, col('author_id', 'int')], {
				foreignKeys: [fk(['author_id'], 'user', ['id'], { onDelete: 'restrict' })],
			}),
		])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].foreignKeys[0].kind).toBe('changed')
	})
})

// ---- worst-of aggregation --------------------------------------------------

describe('diffSchema — table confidence is worst-of children', function () {
	it('a destructive column drives the table to destructive despite safe siblings', function () {
		const from = schema([
			table('t', [idCol, col('legacy', 'text', { nullable: true })]),
		])
		const to = schema([
			table('t', [
				idCol,
				col('bio', 'text', { nullable: true }), // safe add
			]),
		])
		const diff = diffSchema(from, to)
		// bio added (safe) + legacy removed (destructive)
		expect(diff.tables[0].confidence).toBe('destructive')
	})

	it('a review change wins over only-safe siblings', function () {
		const from = schema([table('t', [idCol, col('c', 'int', { default: '0' })])])
		const to = schema([
			table('t', [
				idCol,
				col('c', 'int', { default: '1' }), // review
				col('extra', 'text', { nullable: true }), // safe add
			]),
		])
		const diff = diffSchema(from, to)
		expect(diff.tables[0].confidence).toBe('review')
	})
})

// ---- determinism -----------------------------------------------------------

describe('diffSchema — output ordering', function () {
	it('tables and columns come out sorted by name', function () {
		const from = schema([])
		const to = schema([
			table('zebra', [col('beta', 'text', { nullable: true }), col('alpha', 'text', { nullable: true })]),
			table('apple', [col('id', 'int')]),
		])
		const diff = diffSchema(from, to)
		expect(diff.tables.map((t) => t.name)).toEqual(['apple', 'zebra'])
		const zebra = diff.tables.find((t) => t.name === 'zebra')!
		expect(zebra.columns.map((c) => c.name)).toEqual(['alpha', 'beta'])
	})
})

import type { NormalizedType } from '@studio/features/orm-cockpit/ir/types'
import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'

/**
 * Parse a Prisma `schema.prisma` document into the normalized {@link SchemaIR}.
 *
 * Why a hand-written line/block parser (and not `@prisma/internals`'s
 * `getDMMF`)? `packages/studio` is a Vite RENDERER bundle that runs in the
 * browser. `@prisma/internals` is Node-only, filesystem-dependent, and very
 * heavy — it cannot run in this environment, and it is not a studio dependency.
 * Adding it is out of scope (no new deps). The `.prisma` format is
 * line-oriented and regular enough that a focused parser covers the common set
 * deterministically; anything unrecognized is flagged as a warning and the
 * affected type/default collapses to `'unknown'` rather than throwing.
 *
 * Output matches the live mapper (`fromLiveSchema`): tables/columns/indexes/
 * foreignKeys sorted by name; primary-key and index column order preserved.
 */
export function parsePrismaSchema(text: string): { ir: SchemaIR; warnings: string[] } {
	const warnings: string[] = []
	const lines = stripComments(text).split('\n')

	const blocks = collectBlocks(lines)

	// Resolve the dialect from the datasource provider; default to postgres.
	let dialect: Dialect = 'postgres'
	const datasource = blocks.find(function (b) {
		return b.kind === 'datasource'
	})
	if (datasource) {
		dialect = providerToDialect(datasource.body, warnings)
	}

	// Enum names are needed up front so enum-typed fields are treated as text.
	const enumNames = new Set<string>()
	for (const block of blocks) {
		if (block.kind === 'enum') {
			enumNames.add(block.name)
		}
	}

	// Model names: any field whose type is another model/enum-of-relation is a
	// relation/virtual field, not a scalar column.
	const modelNames = new Set<string>()
	for (const block of blocks) {
		if (block.kind === 'model') {
			modelNames.add(block.name)
		}
	}

	const tables: TableIR[] = []
	for (const block of blocks) {
		if (block.kind !== 'model') {
			continue
		}
		tables.push(
			parseModel(block, { dialect, enumNames, modelNames, blocks, warnings }),
		)
	}

	tables.sort(byName)

	return { ir: { dialect, tables }, warnings }
}

type TBlockKind = 'datasource' | 'generator' | 'model' | 'enum' | 'type' | 'view'

type TBlock = {
	kind: TBlockKind
	name: string
	body: string[]
}

type TParseCtx = {
	dialect: Dialect
	enumNames: Set<string>
	modelNames: Set<string>
	blocks: TBlock[]
	warnings: string[]
}

/** Strip `//` line comments and `///` doc comments; leave string contents
 * intact (a `//` inside a quoted default would be unusual in practice, and we
 * keep the parser simple/conservative). */
function stripComments(text: string): string {
	return text
		.split('\n')
		.map(function (line) {
			const idx = line.indexOf('//')
			if (idx === -1) {
				return line
			}
			return line.slice(0, idx)
		})
		.join('\n')
}

/** Split the document into top-level `keyword Name { ... }` blocks. */
function collectBlocks(lines: string[]): TBlock[] {
	const blocks: TBlock[] = []
	let current: TBlock | null = null

	for (const raw of lines) {
		const line = raw.trim()
		if (line.length === 0) {
			continue
		}

		if (current === null) {
			const header = matchBlockHeader(line)
			if (header) {
				current = { kind: header.kind, name: header.name, body: [] }
			}
			continue
		}

		if (line === '}') {
			blocks.push(current)
			current = null
			continue
		}

		current.body.push(line)
	}

	return blocks
}

function matchBlockHeader(line: string): { kind: TBlockKind; name: string } | null {
	const m = line.match(/^(datasource|generator|model|enum|type|view)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/)
	if (!m) {
		return null
	}
	return { kind: m[1] as TBlockKind, name: m[2] }
}

function providerToDialect(body: string[], warnings: string[]): Dialect {
	for (const line of body) {
		const m = line.match(/^provider\s*=\s*"([^"]+)"/)
		if (!m) {
			continue
		}
		const provider = m[1].toLowerCase()
		switch (provider) {
			case 'postgresql':
			case 'postgres':
				return 'postgres'
			case 'mysql':
				return 'mysql'
			case 'sqlite':
				return 'sqlite'
			case 'cockroachdb':
				return 'postgres'
			default:
				warnings.push(
					`datasource provider "${m[1]}" is not a recognized SQL dialect; defaulting to postgres`,
				)
				return 'postgres'
		}
	}
	return 'postgres'
}

function parseModel(block: TBlock, ctx: TParseCtx): TableIR {
	const columns: ColumnIR[] = []
	const indexes: IndexIR[] = []
	const foreignKeys: ForeignKeyIR[] = []
	let primaryKey: string[] = []

	// Map a Prisma field name -> DB column name (@map). Needed to translate
	// block-level @@id/@@unique/@@index column references onto real DB names.
	const fieldToColumn = new Map<string, string>()
	// Track scalar field type per field (for FK relation resolution).
	const fieldScalarType = new Map<string, string>()

	const tableName = readBlockMap(block.body) ?? block.name

	for (const line of block.body) {
		if (line.startsWith('@@')) {
			// Handled in a second pass once we know fieldToColumn mappings.
			continue
		}

		const field = parseField(line, ctx, block.name)
		if (!field) {
			continue
		}

		fieldToColumn.set(field.fieldName, field.column ? field.column.name : field.dbName)
		fieldScalarType.set(field.fieldName, field.scalarType)

		if (field.column) {
			columns.push(field.column)
			if (field.isPrimaryKey) {
				primaryKey.push(field.column.name)
			}
			if (field.isUnique) {
				indexes.push({
					name: `${tableName}_${field.column.name}_key`,
					columns: [field.column.name],
					unique: true,
				})
			}
		}

		if (field.foreignKey) {
			foreignKeys.push(field.foreignKey)
		}
	}

	// Second pass: block-level attributes referencing field names.
	for (const line of block.body) {
		if (!line.startsWith('@@')) {
			continue
		}
		applyBlockAttribute(line, {
			ctx,
			tableName,
			fieldToColumn,
			onPrimaryKey(cols) {
				primaryKey = cols
			},
			onIndex(index) {
				indexes.push(index)
			},
		})
	}

	const ir: TableIR = {
		name: tableName,
		columns: columns.sort(byName),
		primaryKey,
		indexes: indexes.sort(byName),
		foreignKeys: foreignKeys.sort(byForeignKey),
	}

	if (ctx.dialect === 'postgres') {
		ir.schema = 'public'
	}

	return ir
}

type TParsedField = {
	fieldName: string
	dbName: string
	scalarType: string
	column: ColumnIR | null
	isPrimaryKey: boolean
	isUnique: boolean
	foreignKey: ForeignKeyIR | null
}

function parseField(line: string, ctx: TParseCtx, modelName: string): TParsedField | null {
	const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)(\[\])?(\?)?\s*(.*)$/)
	if (!m) {
		return null
	}

	const fieldName = m[1]
	const baseType = m[2]
	const isList = m[3] === '[]'
	const nullable = m[4] === '?'
	const attrs = m[5] ?? ''

	const dbName = readMapAttr(attrs) ?? fieldName

	// Relation/virtual field: type is another model. These never produce a
	// scalar column; instead resolve the FK from @relation if present.
	if (ctx.modelNames.has(baseType)) {
		const fk = parseRelationFk(attrs, baseType, modelName, ctx)
		return {
			fieldName,
			dbName,
			scalarType: baseType,
			column: null,
			isPrimaryKey: false,
			isUnique: false,
			foreignKey: fk,
		}
	}

	const isEnum = ctx.enumNames.has(baseType)
	if (isEnum) {
		ctx.warnings.push(
			`field ${modelName}.${fieldName} uses enum type "${baseType}"; treated as text`,
		)
	}

	// List scalar fields (e.g. String[]) are not a single column in a SQL
	// table in the relational connectors; flag and skip producing a column.
	if (isList) {
		ctx.warnings.push(
			`field ${modelName}.${fieldName} is a scalar list ("${baseType}[]"); skipped (not a single SQL column)`,
		)
		return {
			fieldName,
			dbName,
			scalarType: baseType,
			column: null,
			isPrimaryKey: false,
			isUnique: false,
			foreignKey: null,
		}
	}

	const native = readNativeType(attrs)
	const normalized = isEnum
		? 'text'
		: mapPrismaScalar(baseType, native, ctx.dialect)

	if (normalized === 'unknown' && !isEnum) {
		ctx.warnings.push(
			`field ${modelName}.${fieldName} has unrecognized type "${baseType}${native ? ` @db.${native}` : ''}"; mapped to 'unknown'`,
		)
	}

	const def = parseDefault(attrs, ctx, modelName, fieldName)

	const column: ColumnIR = {
		name: dbName,
		type: normalized,
		rawType: native ? `${baseType} @db.${native}` : baseType,
		nullable,
		default: def.text,
		autoIncrement: def.autoIncrement,
	}

	return {
		fieldName,
		dbName,
		scalarType: baseType,
		column,
		isPrimaryKey: /@id\b/.test(attrs),
		isUnique: /@unique\b/.test(attrs),
		foreignKey: null,
	}
}

/** Map a Prisma scalar (plus optional `@db.Native`) to a {@link NormalizedType}. */
function mapPrismaScalar(
	scalar: string,
	native: string | null,
	dialect: Dialect,
): NormalizedType {
	// Native type refinements where clear.
	if (native) {
		const refined = refineNative(native)
		if (refined) {
			return refined
		}
	}

	switch (scalar) {
		case 'Int':
			return 'int'
		case 'BigInt':
			return 'bigint'
		case 'Float':
			return 'double'
		case 'Decimal':
			return 'decimal'
		case 'Boolean':
			return 'bool'
		case 'String':
			// Prisma maps String -> text on postgres, varchar(191) on mysql.
			return dialect === 'mysql' ? 'varchar' : 'text'
		case 'DateTime':
			return 'timestamp'
		case 'Json':
			return dialect === 'postgres' ? 'jsonb' : 'json'
		case 'Bytes':
			return 'bytes'
		default:
			return 'unknown'
	}
}

/** Refine a `@db.Native` type to a canonical type when unambiguous. */
function refineNative(native: string): NormalizedType | null {
	const t = native.toLowerCase()
	if (t.startsWith('uuid')) return 'uuid'
	if (t.startsWith('varchar') || t.startsWith('char') || t.startsWith('nvarchar')) return 'varchar'
	if (t.startsWith('text') || t.startsWith('longtext') || t.startsWith('mediumtext')) return 'text'
	if (t.startsWith('smallint')) return 'smallint'
	if (t.startsWith('bigint')) return 'bigint'
	if (t.startsWith('integer') || t.startsWith('int')) return 'int'
	if (t.startsWith('jsonb')) return 'jsonb'
	if (t.startsWith('json')) return 'json'
	if (t.startsWith('timestamptz')) return 'timestamptz'
	if (t.startsWith('timestamp')) return 'timestamp'
	if (t.startsWith('date')) return 'date'
	if (t.startsWith('time')) return 'time'
	if (t.startsWith('decimal') || t.startsWith('numeric')) return 'decimal'
	if (t.startsWith('double')) return 'double'
	if (t.startsWith('real') || t.startsWith('float')) return 'float'
	if (t.startsWith('boolean') || t.startsWith('bit')) return 'bool'
	if (t.startsWith('bytea') || t.startsWith('blob') || t.startsWith('binary')) return 'bytes'
	return null
}

function readNativeType(attrs: string): string | null {
	const m = attrs.match(/@db\.([A-Za-z0-9_]+(?:\([^)]*\))?)/)
	return m ? m[1] : null
}

type TDefault = { text: string | null; autoIncrement: boolean }

function parseDefault(
	attrs: string,
	ctx: TParseCtx,
	modelName: string,
	fieldName: string,
): TDefault {
	const m = attrs.match(/@default\(([\s\S]*?)\)\s*(?:@|$)/) ?? attrs.match(/@default\((.*)\)/)
	if (!m) {
		return { text: null, autoIncrement: false }
	}
	const inner = m[1].trim()

	if (/^autoincrement\(\)$/.test(inner)) {
		return { text: null, autoIncrement: true }
	}
	if (/^now\(\)$/.test(inner)) {
		return { text: 'now()', autoIncrement: false }
	}
	if (/^uuid\(/.test(inner)) {
		return { text: 'uuid()', autoIncrement: false }
	}
	if (/^cuid\(/.test(inner)) {
		return { text: 'cuid()', autoIncrement: false }
	}
	if (/^dbgenerated\(/.test(inner)) {
		ctx.warnings.push(
			`field ${modelName}.${fieldName} uses @default(dbgenerated(...)); default mapped to 'unknown'`,
		)
		return { text: 'unknown', autoIncrement: false }
	}

	// String literal default.
	const str = inner.match(/^"([\s\S]*)"$/)
	if (str) {
		return { text: str[1], autoIncrement: false }
	}

	// Numeric / boolean / bare identifier (enum value) literal.
	if (/^(true|false|-?\d+(\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)$/.test(inner)) {
		return { text: inner, autoIncrement: false }
	}

	ctx.warnings.push(
		`field ${modelName}.${fieldName} has unrecognized @default(${inner}); default mapped to 'unknown'`,
	)
	return { text: 'unknown', autoIncrement: false }
}

/** Parse the FK described by a relation field's `@relation(...)`.
 * Resolves referenced column names against the referenced model's @map'd
 * scalar fields. */
function parseRelationFk(
	attrs: string,
	refModelName: string,
	localModelName: string,
	ctx: TParseCtx,
): ForeignKeyIR | null {
	const m = attrs.match(/@relation\(([\s\S]*)\)/)
	if (!m) {
		return null
	}
	const inner = m[1]

	const fields = readNameList(inner, 'fields')
	const references = readNameList(inner, 'references')
	if (fields.length === 0 || references.length === 0) {
		// The owning side carries fields/references; the inverse side doesn't.
		return null
	}

	const refTableName = resolveTableName(refModelName, ctx)

	const fk: ForeignKeyIR = {
		columns: fields.map(function (f) {
			return resolveColumnName(localModelName, f, ctx)
		}),
		refTable: refTableName,
		refColumns: references.map(function (ref) {
			return resolveColumnName(refModelName, ref, ctx)
		}),
	}

	const onDelete = readKeyword(inner, 'onDelete')
	if (onDelete) {
		fk.onDelete = onDelete
	}
	const onUpdate = readKeyword(inner, 'onUpdate')
	if (onUpdate) {
		fk.onUpdate = onUpdate
	}

	return fk
}

function readNameList(inner: string, key: string): string[] {
	const m = inner.match(new RegExp(`${key}\\s*:\\s*\\[([^\\]]*)\\]`))
	if (!m) {
		return []
	}
	return m[1]
		.split(',')
		.map(function (s) {
			return s.trim()
		})
		.filter(function (s) {
			return s.length > 0
		})
}

function readKeyword(inner: string, key: string): string | undefined {
	const m = inner.match(new RegExp(`${key}\\s*:\\s*([A-Za-z]+)`))
	return m ? m[1] : undefined
}

function resolveTableName(modelName: string, ctx: TParseCtx): string {
	const block = ctx.blocks.find(function (b) {
		return b.kind === 'model' && b.name === modelName
	})
	if (!block) {
		return modelName
	}
	return readBlockMap(block.body) ?? modelName
}

/** Resolve a referenced field name to its DB column name (honoring @map). */
function resolveColumnName(modelName: string, fieldName: string, ctx: TParseCtx): string {
	const block = ctx.blocks.find(function (b) {
		return b.kind === 'model' && b.name === modelName
	})
	if (!block) {
		return fieldName
	}
	for (const line of block.body) {
		const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+/)
		if (m && m[1] === fieldName) {
			return readMapAttr(line) ?? fieldName
		}
	}
	return fieldName
}

type TBlockAttrHandlers = {
	ctx: TParseCtx
	tableName: string
	fieldToColumn: Map<string, string>
	onPrimaryKey(cols: string[]): void
	onIndex(index: IndexIR): void
}

function applyBlockAttribute(line: string, h: TBlockAttrHandlers): void {
	if (line.startsWith('@@id')) {
		const cols = readBracketList(line).map(function (f) {
			return h.fieldToColumn.get(f) ?? f
		})
		h.onPrimaryKey(cols)
		return
	}
	if (line.startsWith('@@unique')) {
		const cols = readBracketList(line).map(function (f) {
			return h.fieldToColumn.get(f) ?? f
		})
		h.onIndex({
			name: namedIndex(line, h.tableName, cols, 'key'),
			columns: cols,
			unique: true,
		})
		return
	}
	if (line.startsWith('@@index')) {
		const cols = readBracketList(line).map(function (f) {
			return h.fieldToColumn.get(f) ?? f
		})
		h.onIndex({
			name: namedIndex(line, h.tableName, cols, 'idx'),
			columns: cols,
			unique: false,
		})
		return
	}
	if (line.startsWith('@@map')) {
		return
	}
	// Other block attributes (e.g. @@ignore, @@fulltext, @@schema) are not
	// modeled; note them conservatively.
	const attrName = line.match(/^@@[A-Za-z]+/)
	h.ctx.warnings.push(
		`model ${h.tableName}: block attribute "${attrName ? attrName[0] : line}" is not modeled and was ignored`,
	)
}

function namedIndex(line: string, table: string, cols: string[], suffix: string): string {
	const explicit = line.match(/(?:name|map)\s*:\s*"([^"]+)"/)
	if (explicit) {
		return explicit[1]
	}
	return `${table}_${cols.join('_')}_${suffix}`
}

/** Read the first `[...]` list of field names from a block attribute. */
function readBracketList(line: string): string[] {
	const m = line.match(/\[([^\]]*)\]/)
	if (!m) {
		return []
	}
	return m[1]
		.split(',')
		.map(function (s) {
			// Drop per-column sort/length modifiers like `email(sort: Desc)`.
			return s.trim().replace(/\(.*$/, '').trim()
		})
		.filter(function (s) {
			return s.length > 0
		})
}

function readBlockMap(body: string[]): string | null {
	for (const line of body) {
		if (line.startsWith('@@map')) {
			const m = line.match(/@@map\(\s*"([^"]+)"\s*\)/)
			if (m) {
				return m[1]
			}
		}
	}
	return null
}

function readMapAttr(attrs: string): string | null {
	const m = attrs.match(/@map\(\s*"([^"]+)"\s*\)/)
	return m ? m[1] : null
}

function byName(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name)
}

function byForeignKey(a: ForeignKeyIR, b: ForeignKeyIR): number {
	const table = a.refTable.localeCompare(b.refTable)
	if (table !== 0) {
		return table
	}
	return a.columns.join(',').localeCompare(b.columns.join(','))
}

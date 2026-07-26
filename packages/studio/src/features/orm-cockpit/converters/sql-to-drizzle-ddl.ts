/**
 * SQL DDL → frozen {@link SchemaIR}.
 *
 * Supported statements: `CREATE TABLE`, `CREATE [UNIQUE] INDEX`, and the
 * `ALTER TABLE … ADD` forms that carry schema information (column, primary key,
 * unique, foreign key). Everything else raises `unsupported-construct` naming
 * the offending construct; severable noise (CHECK constraints, partial-index
 * predicates, storage clauses) is dropped with a warning instead.
 */

import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	SchemaIR,
	TableIR
} from '@studio/features/orm-cockpit/ir/types'
import type { TToken } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-lexer'
import {
	TokenStream,
	describe,
	parseError,
	unsupported
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-lexer'
import {
	SERIAL_BUILDERS,
	isTypeContinuation,
	mapSqlType,
	typeParamsFor
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-typemap'

export type TSchemaPlan = {
	ir: SchemaIR
	/** Table names in declaration order — the emitter's stable tiebreak. */
	tableOrder: string[]
	/** Table name → column names in declaration order. */
	columnOrder: Map<string, string[]>
	warnings: string[]
}

type TDraftTable = {
	name: string
	columns: ColumnIR[]
	primaryKey: string[]
	indexes: IndexIR[]
	foreignKeys: ForeignKeyIR[]
}

const FK_ACTION_WORDS = ['CASCADE', 'RESTRICT']

export function parseSchemaScript(stream: TokenStream, dialect: Dialect): TSchemaPlan {
	const warnings: string[] = []
	const drafts: TDraftTable[] = []
	const byName = new Map<string, TDraftTable>()

	while (!stream.atEof()) {
		if (stream.matchPunct(';')) {
			continue
		}
		const line = stream.line
		if (stream.matchKeyword('CREATE')) {
			parseCreate(stream, dialect, drafts, byName, warnings)
			continue
		}
		if (stream.matchKeyword('ALTER')) {
			parseAlter(stream, dialect, byName, warnings)
			continue
		}
		unsupported(
			`only CREATE TABLE, CREATE INDEX and ALTER TABLE … ADD are supported in the schema surface; found ${describe(stream.peek())}`,
			line
		)
	}

	if (drafts.length === 0) {
		parseError('no CREATE TABLE statement was found', 1)
	}

	const columnOrder = new Map<string, string[]>()
	const tables: TableIR[] = drafts.map(function (draft) {
		columnOrder.set(
			draft.name,
			draft.columns.map((column) => column.name)
		)
		const table: TableIR = {
			name: draft.name,
			columns: [...draft.columns].sort(byNameAsc),
			primaryKey: draft.primaryKey,
			indexes: [...draft.indexes].sort(byNameAsc),
			foreignKeys: [...draft.foreignKeys].sort(byForeignKey)
		}
		if (dialect === 'postgres') {
			table.schema = 'public'
		}
		return table
	})

	return {
		ir: { dialect, tables: [...tables].sort(byNameAsc) },
		tableOrder: drafts.map((draft) => draft.name),
		columnOrder,
		warnings
	}
}

function parseCreate(
	stream: TokenStream,
	dialect: Dialect,
	drafts: TDraftTable[],
	byName: Map<string, TDraftTable>,
	warnings: string[]
): void {
	const line = stream.line
	if (stream.matchKeyword('TABLE')) {
		const draft = parseCreateTable(stream, dialect, warnings)
		if (byName.has(draft.name)) {
			parseError(`table "${draft.name}" is created twice`, line)
		}
		drafts.push(draft)
		byName.set(draft.name, draft)
		return
	}
	const unique = stream.matchKeyword('UNIQUE')
	if (stream.matchKeyword('INDEX')) {
		parseCreateIndex(stream, unique, byName, warnings)
		return
	}
	unsupported(`CREATE ${stream.peek().value.toUpperCase()} is not supported`, line)
}

function parseCreateTable(stream: TokenStream, dialect: Dialect, warnings: string[]): TDraftTable {
	stream.matchKeywordSequence('IF', 'NOT', 'EXISTS')
	const line = stream.line
	const name = parseQualifiedName(stream, dialect, warnings, line)

	const draft: TDraftTable = { name, columns: [], primaryKey: [], indexes: [], foreignKeys: [] }
	stream.expectPunct('(')

	do {
		if (stream.isPunct(')')) {
			break
		}
		if (isTableConstraintStart(stream, dialect)) {
			parseTableConstraint(stream, dialect, draft, warnings)
		} else {
			parseColumnDefinition(stream, dialect, draft, warnings)
		}
	} while (stream.matchPunct(','))

	stream.expectPunct(')')
	skipTableOptions(stream, warnings)
	stream.matchPunct(';')

	if (draft.columns.length === 0) {
		parseError(`table "${name}" has no columns`, line)
	}
	return draft
}

function parseQualifiedName(
	stream: TokenStream,
	dialect: Dialect,
	warnings: string[],
	line: number
): string {
	let name = stream.identifier()
	if (stream.matchPunct('.')) {
		const qualifier = name
		name = stream.identifier()
		if (qualifier !== 'public' && qualifier !== 'main' && qualifier !== 'dbo') {
			warnings.push(
				`line ${line}: schema qualifier "${qualifier}" on "${name}" is dropped — the emitted ${builderName(dialect)} has no schema binding`
			)
		}
	}
	return name
}

function builderName(dialect: Dialect): string {
	return dialect === 'postgres' ? 'pgTable' : dialect === 'mysql' ? 'mysqlTable' : 'sqliteTable'
}

const CONSTRAINT_STARTERS = ['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK']

function isTableConstraintStart(stream: TokenStream, dialect: Dialect): boolean {
	if (stream.isAnyKeyword(CONSTRAINT_STARTERS)) {
		return true
	}
	// MySQL spells table indexes `KEY name (cols)` / `INDEX name (cols)`.
	return dialect === 'mysql' && stream.isAnyKeyword(['KEY', 'INDEX'])
}

function parseColumnDefinition(
	stream: TokenStream,
	dialect: Dialect,
	draft: TDraftTable,
	warnings: string[]
): void {
	const line = stream.line
	const name = stream.identifier()
	const { token, args } = parseTypeToken(stream, name, line)
	const mapping = mapSqlType(dialect, token, args)

	const builder = mapping?.builder ?? 'text'
	const type = mapping?.type ?? 'unknown'
	if (!mapping) {
		warnings.push(
			`line ${line}: column "${name}" has type ${token}${args.length > 0 ? `(${args.join(',')})` : ''} which has no Drizzle builder in the ${dialect} dialect; emitted text() — review it`
		)
	} else if (mapping.note) {
		warnings.push(`line ${line}: column "${name}": ${mapping.note}`)
	}

	const column: ColumnIR = {
		name,
		type,
		rawType: builder,
		typeParams: typeParamsFor(builder, args),
		nullable: true,
		default: null,
		autoIncrement: SERIAL_BUILDERS.has(builder)
	}

	let isPrimaryKey = false
	let unique = false

	for (;;) {
		const modLine = stream.line
		if (stream.matchKeywordSequence('PRIMARY', 'KEY')) {
			isPrimaryKey = true
			column.nullable = false
			if (stream.matchKeyword('AUTOINCREMENT')) {
				column.autoIncrement = true
			}
			stream.matchKeyword('ASC')
			stream.matchKeyword('DESC')
			continue
		}
		if (stream.matchKeywordSequence('NOT', 'NULL')) {
			column.nullable = false
			continue
		}
		if (stream.matchKeyword('NULL')) {
			continue
		}
		if (stream.matchKeyword('UNIQUE')) {
			stream.matchKeyword('KEY')
			unique = true
			continue
		}
		if (stream.matchKeyword('DEFAULT')) {
			column.default = parseDefaultExpression(stream, dialect)
			continue
		}
		if (stream.matchKeyword('AUTO_INCREMENT') || stream.matchKeyword('AUTOINCREMENT')) {
			column.autoIncrement = true
			continue
		}
		if (stream.matchKeyword('GENERATED')) {
			parseGeneratedClause(stream, column, name, modLine)
			continue
		}
		if (stream.matchKeyword('REFERENCES')) {
			draft.foreignKeys.push(parseReferencesClause(stream, dialect, [name], warnings))
			continue
		}
		if (stream.matchKeyword('CHECK')) {
			skipBalancedParens(stream)
			warnings.push(
				`line ${modLine}: CHECK constraint on "${name}" dropped — Drizzle has no IR for it`
			)
			continue
		}
		if (stream.matchKeyword('COLLATE')) {
			stream.identifier()
			continue
		}
		if (stream.matchKeywordSequence('CHARACTER', 'SET')) {
			stream.identifier()
			continue
		}
		if (stream.matchKeyword('COMMENT')) {
			stream.next()
			continue
		}
		if (
			stream.matchKeyword('UNSIGNED') ||
			stream.matchKeyword('SIGNED') ||
			stream.matchKeyword('ZEROFILL')
		) {
			continue
		}
		if (stream.matchKeywordSequence('ON', 'UPDATE')) {
			parseDefaultExpression(stream, dialect)
			warnings.push(
				`line ${modLine}: ON UPDATE clause on "${name}" dropped — express it with .$onUpdate() in Drizzle`
			)
			continue
		}
		if (stream.isPunct(',') || stream.isPunct(')') || stream.isPunct(';') || stream.atEof()) {
			break
		}
		unsupported(
			`unsupported column constraint ${describe(stream.peek())} on "${name}"`,
			stream.line
		)
	}

	// `DEFAULT nextval('…')` in a pg dump is what SERIAL desugars to.
	if (dialect === 'postgres' && column.default !== null && /^nextval\(/i.test(column.default)) {
		column.default = null
		column.autoIncrement = true
		column.rawType =
			column.type === 'bigint'
				? 'bigserial'
				: column.type === 'smallint'
					? 'smallserial'
					: 'serial'
	}

	if (isPrimaryKey) {
		draft.primaryKey.push(name)
	}
	if (unique) {
		draft.indexes.push({ name: `${draft.name}_${name}_unique`, columns: [name], unique: true })
	}
	draft.columns.push(column)
}

function parseGeneratedClause(
	stream: TokenStream,
	column: ColumnIR,
	name: string,
	line: number
): void {
	if (stream.matchKeywordSequence('ALWAYS', 'AS', 'IDENTITY')) {
		column.autoIncrement = true
	} else if (stream.matchKeywordSequence('BY', 'DEFAULT', 'AS', 'IDENTITY')) {
		column.autoIncrement = true
	} else {
		unsupported(`GENERATED ... AS (expression) on "${name}" is not supported`, line)
	}
	if (stream.isPunct('(')) {
		skipBalancedParens(stream)
	}
}

type TTypeToken = { token: string; args: string[] }

function parseTypeToken(stream: TokenStream, columnName: string, line: number): TTypeToken {
	if (!stream.isIdentifier()) {
		parseError(
			`expected a type for column "${columnName}" but found ${describe(stream.peek())}`,
			line
		)
	}
	const words = [stream.identifier()]
	while (stream.isIdentifier() && isTypeContinuation(stream.peek().value)) {
		words.push(stream.identifier())
	}
	const args: string[] = []
	if (stream.matchPunct('(')) {
		do {
			const token = stream.next()
			if (token.kind === 'number' || token.kind === 'ident' || token.kind === 'string') {
				args.push(token.value)
			} else {
				parseError(
					`unexpected ${describe(token)} in the type of "${columnName}"`,
					token.line
				)
			}
		} while (stream.matchPunct(','))
		stream.expectPunct(')')
	}
	return { token: words.join(' ').toUpperCase(), args }
}

/**
 * Normalize a DEFAULT expression to the textual form `parse-drizzle-schema`
 * produces, so a schema survives the SQL → Drizzle → IR round trip: literals
 * keep their text, clock/UUID generators collapse to `now()` /
 * `gen_random_uuid()`, and anything else keeps its raw SQL (emitted as ``sql`…` ``).
 */
function parseDefaultExpression(stream: TokenStream, dialect: Dialect): string | null {
	const token = stream.peek()

	if (token.kind === 'string') {
		stream.next()
		skipCast(stream)
		return token.value
	}
	if (token.kind === 'number') {
		stream.next()
		skipCast(stream)
		return token.value
	}
	if (stream.isPunct('-') && stream.peek(1).kind === 'number') {
		stream.next()
		const number = stream.next()
		return `-${number.value}`
	}
	if (stream.isKeyword('TRUE') || stream.isKeyword('FALSE')) {
		return stream.next().value.toLowerCase()
	}
	if (stream.isKeyword('NULL')) {
		stream.next()
		return null
	}
	if (stream.isPunct('(')) {
		const raw = captureBalancedParens(stream)
		return raw
	}

	const start = stream.position
	const raw = captureExpressionText(stream)
	if (raw.length === 0) {
		stream.reset(start)
		parseError(`expected a DEFAULT value but found ${describe(stream.peek())}`, stream.line)
	}
	const canonical = raw.replace(/\s+/g, '').toLowerCase()
	if (
		canonical === 'current_timestamp' ||
		canonical.startsWith('current_timestamp(') ||
		canonical === 'now()' ||
		canonical === 'localtimestamp'
	) {
		return 'now()'
	}
	if (
		dialect === 'postgres' &&
		(canonical === 'gen_random_uuid()' || canonical === 'uuid_generate_v4()')
	) {
		return 'gen_random_uuid()'
	}
	return raw
}

function skipCast(stream: TokenStream): void {
	while (stream.matchPunct('::')) {
		stream.identifier()
	}
}

const EXPRESSION_OPERATORS = ['+', '-', '*', '/', '%', '||', '::']

/**
 * Capture one DEFAULT expression atom (`nextval('s')`, `CURRENT_TIMESTAMP`,
 * `a || b`) and stop before the next column constraint keyword.
 */
function captureExpressionText(stream: TokenStream): string {
	const parts: string[] = []
	for (;;) {
		const token = stream.peek()
		if (token.kind === 'eof' || token.kind === 'punct') {
			break
		}
		stream.next()
		parts.push(renderToken(token))
		if (stream.isPunct('(')) {
			parts.push(captureBalancedParens(stream, true))
		}
		if (!stream.isAnyPunct(EXPRESSION_OPERATORS)) {
			break
		}
		parts.push(stream.next().value)
	}
	return parts.join('')
}

function captureBalancedParens(stream: TokenStream, keepParens = false): string {
	const parts: string[] = []
	let depth = 0
	do {
		const token = stream.next()
		if (token.kind === 'eof') {
			parseError('unbalanced parentheses', token.line)
		}
		if (token.value === '(') {
			depth += 1
		} else if (token.value === ')') {
			depth -= 1
		}
		parts.push(renderToken(token))
	} while (depth > 0)
	const text = parts.join('')
	return keepParens ? text : text.replace(/^\((.*)\)$/, '$1')
}

function renderToken(token: TToken): string {
	if (token.kind === 'string') {
		return `'${token.value.replace(/'/g, "''")}'`
	}
	if (token.kind === 'quoted') {
		return `"${token.value}"`
	}
	return token.value
}

function skipBalancedParens(stream: TokenStream): void {
	captureBalancedParens(stream)
}

function parseReferencesClause(
	stream: TokenStream,
	dialect: Dialect,
	columns: string[],
	warnings: string[]
): ForeignKeyIR {
	const line = stream.line
	const refTable = parseQualifiedName(stream, dialect, warnings, line)
	const refColumns: string[] = []
	if (stream.matchPunct('(')) {
		do {
			refColumns.push(stream.identifier())
		} while (stream.matchPunct(','))
		stream.expectPunct(')')
	}
	if (refColumns.length === 0) {
		unsupported(`REFERENCES ${refTable} without an explicit column list is not supported`, line)
	}
	const fk: ForeignKeyIR = { columns, refTable, refColumns }
	parseFkActions(stream, fk, warnings)
	return fk
}

function parseFkActions(stream: TokenStream, fk: ForeignKeyIR, warnings: string[]): void {
	for (;;) {
		const line = stream.line
		if (stream.matchKeywordSequence('ON', 'DELETE')) {
			fk.onDelete = parseFkAction(stream)
			continue
		}
		if (stream.matchKeywordSequence('ON', 'UPDATE')) {
			fk.onUpdate = parseFkAction(stream)
			continue
		}
		if (
			stream.matchKeywordSequence('DEFERRABLE') ||
			stream.matchKeywordSequence('NOT', 'DEFERRABLE')
		) {
			warnings.push(`line ${line}: DEFERRABLE clause dropped — Drizzle has no IR for it`)
			stream.matchKeywordSequence('INITIALLY', 'DEFERRED')
			stream.matchKeywordSequence('INITIALLY', 'IMMEDIATE')
			continue
		}
		if (
			stream.matchKeywordSequence('MATCH', 'FULL') ||
			stream.matchKeywordSequence('MATCH', 'SIMPLE')
		) {
			warnings.push(`line ${line}: MATCH clause dropped — Drizzle has no IR for it`)
			continue
		}
		return
	}
}

function parseFkAction(stream: TokenStream): string {
	if (stream.matchKeywordSequence('SET', 'NULL')) {
		return 'set null'
	}
	if (stream.matchKeywordSequence('SET', 'DEFAULT')) {
		return 'set default'
	}
	if (stream.matchKeywordSequence('NO', 'ACTION')) {
		return 'no action'
	}
	const token = stream.peek()
	if (token.kind === 'ident' && FK_ACTION_WORDS.includes(token.value.toUpperCase())) {
		stream.next()
		return token.value.toLowerCase()
	}
	return parseError(`unknown referential action ${describe(token)}`, token.line)
}

function parseTableConstraint(
	stream: TokenStream,
	dialect: Dialect,
	draft: TDraftTable,
	warnings: string[]
): void {
	const line = stream.line
	let constraintName: string | null = null
	if (stream.matchKeyword('CONSTRAINT')) {
		constraintName = stream.identifier()
	}

	if (stream.matchKeywordSequence('PRIMARY', 'KEY')) {
		const columns = parseColumnList(stream)
		if (draft.primaryKey.length > 0) {
			parseError(`table "${draft.name}" declares more than one PRIMARY KEY`, line)
		}
		draft.primaryKey.push(...columns)
		return
	}
	if (stream.matchKeyword('UNIQUE')) {
		stream.matchKeyword('KEY')
		stream.matchKeyword('INDEX')
		const explicit = stream.isIdentifier() && !stream.isPunct('(') ? stream.identifier() : null
		const columns = parseColumnList(stream)
		draft.indexes.push({
			name: constraintName ?? explicit ?? `${draft.name}_${columns.join('_')}_unique`,
			columns,
			unique: true
		})
		return
	}
	if (stream.matchKeywordSequence('FOREIGN', 'KEY')) {
		const columns = parseColumnList(stream)
		stream.expectKeyword('REFERENCES')
		draft.foreignKeys.push(parseReferencesClause(stream, dialect, columns, warnings))
		return
	}
	if (stream.matchKeyword('CHECK')) {
		skipBalancedParens(stream)
		warnings.push(
			`line ${line}: CHECK constraint on "${draft.name}" dropped — Drizzle has no IR for it`
		)
		return
	}
	if (dialect === 'mysql' && (stream.matchKeyword('KEY') || stream.matchKeyword('INDEX'))) {
		const explicit = stream.isIdentifier() && !stream.isPunct('(') ? stream.identifier() : null
		const columns = parseColumnList(stream)
		draft.indexes.push({
			name: constraintName ?? explicit ?? `${draft.name}_${columns.join('_')}_idx`,
			columns,
			unique: false
		})
		return
	}
	unsupported(`unsupported table constraint ${describe(stream.peek())}`, stream.line)
}

function parseColumnList(stream: TokenStream): string[] {
	stream.expectPunct('(')
	const columns: string[] = []
	do {
		columns.push(stream.identifier())
		stream.matchKeyword('ASC')
		stream.matchKeyword('DESC')
	} while (stream.matchPunct(','))
	stream.expectPunct(')')
	return columns
}

const STATEMENT_STARTERS = ['CREATE', 'ALTER', 'DROP', 'INSERT', 'UPDATE', 'DELETE', 'SELECT']

function skipTableOptions(stream: TokenStream, warnings: string[]): void {
	if (stream.isPunct(';') || stream.atEof()) {
		return
	}
	const line = stream.line
	const skipped: string[] = []
	while (!stream.atEof() && !stream.isPunct(';') && !stream.isAnyKeyword(STATEMENT_STARTERS)) {
		skipped.push(stream.next().value)
	}
	if (skipped.length > 0) {
		warnings.push(
			`line ${line}: table options (${skipped.join(' ')}) dropped — Drizzle has no IR for them`
		)
	}
}

function parseCreateIndex(
	stream: TokenStream,
	unique: boolean,
	byName: Map<string, TDraftTable>,
	warnings: string[]
): void {
	stream.matchKeywordSequence('IF', 'NOT', 'EXISTS')
	const line = stream.line
	const name = stream.identifier()
	stream.expectKeyword('ON')
	let tableName = stream.identifier()
	if (stream.matchPunct('.')) {
		tableName = stream.identifier()
	}
	if (stream.matchKeyword('USING')) {
		const method = stream.identifier()
		warnings.push(
			`line ${line}: index method USING ${method} dropped — Drizzle has no IR for it`
		)
	}

	stream.expectPunct('(')
	const columns: string[] = []
	do {
		if (!stream.isIdentifier()) {
			unsupported(`expression indexes are not supported (index "${name}")`, stream.line)
		}
		if (stream.isPunct('(', 1)) {
			unsupported(`expression indexes are not supported (index "${name}")`, stream.line)
		}
		columns.push(stream.identifier())
		stream.matchKeyword('ASC')
		stream.matchKeyword('DESC')
		stream.matchKeywordSequence('NULLS', 'FIRST')
		stream.matchKeywordSequence('NULLS', 'LAST')
	} while (stream.matchPunct(','))
	stream.expectPunct(')')

	if (stream.matchKeyword('WHERE')) {
		while (!stream.atEof() && !stream.isPunct(';')) {
			stream.next()
		}
		warnings.push(
			`line ${line}: partial-index predicate on "${name}" dropped — the IR has no place for it`
		)
	}
	stream.matchPunct(';')

	const draft = byName.get(tableName)
	if (!draft) {
		parseError(`CREATE INDEX "${name}" references unknown table "${tableName}"`, line)
	}
	const existing = draft.indexes.find(function (index) {
		return index.name === name
	})
	if (existing) {
		return
	}
	draft.indexes.push({ name, columns, unique })
}

function parseAlter(
	stream: TokenStream,
	dialect: Dialect,
	byName: Map<string, TDraftTable>,
	warnings: string[]
): void {
	const line = stream.line
	stream.expectKeyword('TABLE')
	stream.matchKeywordSequence('IF', 'EXISTS')
	stream.matchKeyword('ONLY')
	const tableName = parseQualifiedName(stream, dialect, warnings, line)
	const draft = byName.get(tableName)
	if (!draft) {
		parseError(
			`ALTER TABLE "${tableName}" refers to a table that is not created in this script`,
			line
		)
	}

	do {
		if (!stream.matchKeyword('ADD')) {
			unsupported(
				`only ALTER TABLE … ADD is supported; found ${describe(stream.peek())}`,
				stream.line
			)
		}
		if (isTableConstraintStart(stream, dialect)) {
			parseTableConstraint(stream, dialect, draft, warnings)
		} else {
			stream.matchKeyword('COLUMN')
			parseColumnDefinition(stream, dialect, draft, warnings)
		}
	} while (stream.matchPunct(','))

	stream.matchPunct(';')
}

function byNameAsc(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name)
}

function byForeignKey(a: ForeignKeyIR, b: ForeignKeyIR): number {
	const table = a.refTable.localeCompare(b.refTable)
	if (table !== 0) {
		return table
	}
	return a.columns.join(',').localeCompare(b.columns.join(','))
}

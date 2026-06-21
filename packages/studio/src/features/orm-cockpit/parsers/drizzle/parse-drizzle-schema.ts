import ts from 'typescript'
import { normalizeDbType } from '@studio/features/orm-cockpit/ir/normalize-type'
import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	NormalizedType,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'

/**
 * Statically parse a project's Drizzle schema file(s) into the frozen
 * {@link SchemaIR} so it can be diffed against the live DB.
 *
 * STATIC ONLY — we walk the TypeScript AST (`ts.createSourceFile`) and never
 * execute user code. We recognize the common 80% of Drizzle idioms
 * (`pgTable`/`sqliteTable`/`mysqlTable` with column builders + a table-level
 * config callback) and degrade gracefully on the rest: anything unrecognized
 * pushes a human-readable note to `warnings` and marks the affected
 * column type/default `'unknown'`. A parse error in one table never kills the
 * file — each table is parsed defensively.
 *
 * Output shape/sorting mirrors the live mapper (`from-live-schema.ts`): tables,
 * columns, indexes and foreign keys are sorted by name; primary-key and index
 * column ORDER is preserved.
 *
 * Known limitations (surfaced as warnings, not failures):
 *   - barrel/re-export files (`export * from './x'`) — only declarations in the
 *     given files are seen; re-exported tables defined elsewhere are missed.
 *   - helper-wrapped table factories (`export const x = makeTable(...)`) — the
 *     call must be a direct `pgTable(...)`/`sqliteTable(...)`/`mysqlTable(...)`.
 */
export function parseDrizzleSchema(
	files: { path: string; text: string }[],
	dialect: Dialect
): { ir: SchemaIR; warnings: string[] } {
	const warnings: string[] = []
	const tables: TableIR[] = []

	for (const file of files) {
		try {
			parseFile(file, dialect, tables, warnings)
		} catch (error) {
			warnings.push(`${file.path}: failed to parse file (${describeError(error)})`)
		}
	}

	tables.sort(byName)
	return { ir: { dialect, tables }, warnings }
}

const DIALECT_BUILDERS: Record<string, Dialect> = {
	pgTable: 'postgres',
	sqliteTable: 'sqlite',
	mysqlTable: 'mysql',
}

function parseFile(
	file: { path: string; text: string },
	argDialect: Dialect,
	out: TableIR[],
	warnings: string[]
): void {
	const source = ts.createSourceFile(
		file.path,
		file.text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	)

	let sawReExport = false

	source.forEachChild(function (node) {
		if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.exportClause) {
			sawReExport = true
			return
		}

		const found = findTableDeclaration(node)
		if (!found) {
			return
		}

		const builder = found.builderName
		const tableDialect = DIALECT_BUILDERS[builder]
		if (!tableDialect) {
			return
		}

		if (tableDialect !== argDialect) {
			warnings.push(
				`${file.path}: table "${found.varName}" uses ${builder} (${tableDialect}) but the requested dialect was ${argDialect}; parsing it as ${tableDialect}`
			)
		}

		try {
			const table = parseTable(found.call, tableDialect, file.path, warnings)
			if (table) {
				out.push(table)
			}
		} catch (error) {
			warnings.push(
				`${file.path}: failed to parse table "${found.varName}" (${describeError(error)})`
			)
		}
	})

	if (sawReExport) {
		warnings.push(
			`${file.path}: re-export (\`export ... from\`) detected; tables defined in other modules are not followed — pass those files in directly`
		)
	}
}

type TFound = { varName: string; builderName: string; call: ts.CallExpression }

/**
 * Match `export const X = pgTable(...)` (or a plain `const X = pgTable(...)`)
 * and return the call plus the builder identifier name.
 */
function findTableDeclaration(node: ts.Node): TFound | null {
	if (!ts.isVariableStatement(node)) {
		return null
	}
	for (const decl of node.declarationList.declarations) {
		if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
			continue
		}
		const callee = decl.initializer.expression
		if (!ts.isIdentifier(callee)) {
			continue
		}
		if (!DIALECT_BUILDERS[callee.text]) {
			continue
		}
		const varName = ts.isIdentifier(decl.name) ? decl.name.text : '<anonymous>'
		return { varName, builderName: callee.text, call: decl.initializer }
	}
	return null
}

function parseTable(
	call: ts.CallExpression,
	dialect: Dialect,
	filePath: string,
	warnings: string[]
): TableIR | null {
	const args = call.arguments
	if (args.length < 2) {
		warnings.push(`${filePath}: a table call had too few arguments; skipped`)
		return null
	}

	const nameArg = args[0]
	const tableName = literalString(nameArg)
	if (tableName === null) {
		warnings.push(`${filePath}: a table name was not a string literal; skipped`)
		return null
	}

	const columnsArg = args[1]
	if (!ts.isObjectLiteralExpression(columnsArg)) {
		warnings.push(`${filePath}: table "${tableName}" columns argument was not an object literal; skipped`)
		return null
	}

	const columns: ColumnIR[] = []
	// Map of JS property key -> DB column name, for resolving FK/index refs.
	const propToDbName = new Map<string, string>()
	const primaryKey: string[] = []
	const indexes: IndexIR[] = []
	const foreignKeys: ForeignKeyIR[] = []

	for (const prop of columnsArg.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			warnings.push(`${filePath}: table "${tableName}" has a non-standard column property; skipped`)
			continue
		}
		const propKey = propertyName(prop.name)
		if (propKey === null) {
			warnings.push(`${filePath}: table "${tableName}" has a column with a computed key; skipped`)
			continue
		}
		if (!ts.isCallExpression(prop.initializer)) {
			warnings.push(
				`${filePath}: table "${tableName}".${propKey} is not a column builder call; type set to unknown`
			)
			continue
		}

		const parsed = parseColumn(prop.initializer, propKey, dialect, tableName, filePath, warnings)
		columns.push(parsed.column)
		propToDbName.set(propKey, parsed.column.name)
		if (parsed.isPrimaryKey) {
			primaryKey.push(parsed.column.name)
		}
		if (parsed.uniqueIndex) {
			indexes.push(parsed.uniqueIndex)
		}
		if (parsed.foreignKey) {
			foreignKeys.push(parsed.foreignKey)
		}
	}

	// Third argument: the table-level config callback `(t) => ({ ... })`.
	if (args.length >= 3) {
		const configArg = args[2]
		parseTableConfig(configArg, propToDbName, tableName, filePath, {
			primaryKey,
			indexes,
			foreignKeys,
		}, warnings)
	}

	const table: TableIR = {
		name: tableName,
		columns: columns.sort(byName),
		primaryKey,
		indexes: indexes.sort(byName),
		foreignKeys: foreignKeys.sort(byForeignKey),
	}
	if (dialect === 'postgres') {
		table.schema = 'public'
	}
	return table
}

type TColumnResult = {
	column: ColumnIR
	isPrimaryKey: boolean
	uniqueIndex: IndexIR | null
	foreignKey: ForeignKeyIR | null
}

/**
 * Drizzle column builder name → {@link NormalizedType}. We map the builder
 * (e.g. `varchar`, `timestamp`) rather than a SQL string, so this is separate
 * from {@link normalizeDbType} (which keys off live DB type strings). Unknown
 * builders fall back to `normalizeDbType(builder)` and finally `'unknown'`.
 */
const BUILDER_TYPES: Record<string, NormalizedType> = {
	integer: 'int',
	int: 'int',
	tinyint: 'smallint',
	smallint: 'smallint',
	mediumint: 'int',
	bigint: 'bigint',
	serial: 'int',
	bigserial: 'bigint',
	smallserial: 'smallint',
	text: 'text',
	char: 'varchar',
	varchar: 'varchar',
	boolean: 'bool',
	timestamp: 'timestamp',
	datetime: 'timestamp',
	date: 'date',
	time: 'time',
	uuid: 'uuid',
	json: 'json',
	jsonb: 'jsonb',
	numeric: 'decimal',
	decimal: 'decimal',
	real: 'float',
	float: 'float',
	double: 'double',
	doublePrecision: 'double',
	bytea: 'bytes',
	blob: 'bytes',
	binary: 'bytes',
	varbinary: 'bytes',
	vector: 'vector',
}

// Builders that imply an auto-incrementing column.
const AUTO_INCREMENT_BUILDERS = new Set(['serial', 'bigserial', 'smallserial'])

function parseColumn(
	call: ts.CallExpression,
	propKey: string,
	dialect: Dialect,
	tableName: string,
	filePath: string,
	warnings: string[]
): TColumnResult {
	// Unwind the modifier chain to find the base builder call and the list of
	// applied modifier methods (in source order, outermost-last).
	const chain = unwindChain(call)
	const builderName = chain.builderName

	// First builder argument may be the explicit DB column name.
	let dbName = propKey
	const baseArgs = chain.baseCall.arguments
	if (baseArgs.length > 0) {
		const explicit = literalString(baseArgs[0])
		if (explicit !== null) {
			dbName = explicit
		}
	}

	let type: NormalizedType = 'unknown'
	if (builderName && BUILDER_TYPES[builderName]) {
		type = BUILDER_TYPES[builderName]
	} else if (builderName) {
		type = normalizeDbType(builderName, dialect)
	}
	const rawType = builderName ?? 'unknown'
	const typeParams = extractTypeParams(baseArgs)

	if (type === 'unknown') {
		warnings.push(
			`${filePath}: table "${tableName}".${propKey} uses unrecognized builder "${rawType}"; type set to unknown`
		)
	}

	let nullable = true
	let isPrimaryKey = false
	let autoIncrement = AUTO_INCREMENT_BUILDERS.has(builderName ?? '')
	let defaultText: string | null = null
	let uniqueIndex: IndexIR | null = null
	let foreignKey: ForeignKeyIR | null = null

	for (const mod of chain.modifiers) {
		switch (mod.name) {
			case 'primaryKey':
				isPrimaryKey = true
				nullable = false
				break
			case 'notNull':
				nullable = false
				break
			case 'default':
				defaultText = defaultLiteral(mod.args)
				break
			case 'defaultNow':
				defaultText = 'now()'
				break
			case 'defaultRandom':
				defaultText = 'gen_random_uuid()'
				break
			case '$default':
			case '$defaultFn':
			case '$onUpdate':
			case '$onUpdateFn':
				// Runtime functions — we cannot statically evaluate them.
				defaultText = 'unknown'
				break
			case 'autoincrement':
				autoIncrement = true
				break
			case 'unique':
				uniqueIndex = {
					name: uniqueIndexName(mod.args, tableName, dbName),
					columns: [dbName],
					unique: true,
				}
				break
			case 'references':
				foreignKey = parseReferences(mod, [dbName], tableName, filePath, warnings)
				break
			case 'generatedAlwaysAsIdentity':
			case 'generatedByDefaultAsIdentity':
				autoIncrement = true
				break
			default:
				// Unhandled modifiers (.array(), .mode(), length args, etc.) are
				// safely ignored — they don't change the IR fields we compare.
				break
		}
	}

	return {
		column: { name: dbName, type, rawType, typeParams, nullable, default: defaultText, autoIncrement },
		isPrimaryKey,
		uniqueIndex,
		foreignKey,
	}
}

/**
 * Pull length/precision/dimensions out of a builder's options object, e.g.
 * `varchar('x', { length: 255 })`, `numeric('x', { precision: 10, scale: 2 })`,
 * `vector('x', { dimensions: 1536 })`. Returns a normalized param string or
 * undefined when none are present.
 */
function extractTypeParams(args: ts.NodeArray<ts.Expression>): string | undefined {
	let obj: ts.ObjectLiteralExpression | undefined
	for (const arg of args) {
		if (ts.isObjectLiteralExpression(arg)) {
			obj = arg
			break
		}
	}
	if (!obj) {
		return undefined
	}

	const nums = new Map<string, string>()
	for (const prop of obj.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue
		}
		const key = propertyName(prop.name)
		if (key !== null && ts.isNumericLiteral(prop.initializer)) {
			nums.set(key, prop.initializer.text)
		}
	}

	if (nums.has('dimensions')) {
		return nums.get('dimensions')
	}
	if (nums.has('length')) {
		return nums.get('length')
	}
	if (nums.has('precision')) {
		const precision = nums.get('precision')
		return nums.has('scale') ? `${precision},${nums.get('scale')}` : precision
	}
	return undefined
}

type TModifier = { name: string; args: ts.NodeArray<ts.Expression> }
type TChain = {
	baseCall: ts.CallExpression
	builderName: string | null
	modifiers: TModifier[]
}

/**
 * Walk a builder method chain `foo('x').notNull().default(1)` down to the base
 * call and collect the modifiers in source order.
 */
function unwindChain(call: ts.CallExpression): TChain {
	const modifiers: TModifier[] = []
	let current: ts.Expression = call

	while (
		ts.isCallExpression(current) &&
		ts.isPropertyAccessExpression(current.expression)
	) {
		modifiers.unshift({ name: current.expression.name.text, args: current.arguments })
		current = current.expression.expression
	}

	let baseCall: ts.CallExpression
	let builderName: string | null = null
	if (ts.isCallExpression(current)) {
		baseCall = current
		if (ts.isIdentifier(current.expression)) {
			builderName = current.expression.text
		} else if (ts.isPropertyAccessExpression(current.expression)) {
			// e.g. `t.integer(...)` style — take the trailing member name.
			builderName = current.expression.name.text
		}
	} else {
		baseCall = call
	}

	return { baseCall, builderName, modifiers }
}

function parseReferences(
	mod: TModifier,
	columns: string[],
	tableName: string,
	filePath: string,
	warnings: string[]
): ForeignKeyIR | null {
	// `.references(() => other.col, { onDelete: 'cascade' })`
	const refArg = mod.args[0]
	const ref = refArg ? resolveColumnRef(refArg) : null
	if (!ref) {
		warnings.push(
			`${filePath}: table "${tableName}" has a .references() that could not be resolved statically; foreign key skipped`
		)
		return null
	}
	const fk: ForeignKeyIR = {
		columns,
		refTable: ref.tableVar,
		refColumns: [ref.column],
	}
	applyFkActions(mod.args[1], fk)
	return fk
}

/**
 * Resolve `() => other.col` (arrow returning a property access) or a bare
 * `other.col` into its table-variable and column-property names. We use the
 * referenced JS identifiers as a best-effort table/column name; the diff
 * engine compares conservatively when names differ from the DB.
 */
function resolveColumnRef(
	expr: ts.Expression
): { tableVar: string; column: string } | null {
	let body: ts.Expression = expr
	if (ts.isArrowFunction(expr)) {
		if (ts.isBlock(expr.body)) {
			// `() => { return other.col }`
			const ret = expr.body.statements.find(ts.isReturnStatement)
			if (ret && ret.expression) {
				body = ret.expression
			} else {
				return null
			}
		} else {
			body = expr.body
		}
	}
	if (ts.isPropertyAccessExpression(body) && ts.isIdentifier(body.expression)) {
		return { tableVar: body.expression.text, column: body.name.text }
	}
	return null
}

function applyFkActions(optsExpr: ts.Expression | undefined, fk: ForeignKeyIR): void {
	if (!optsExpr || !ts.isObjectLiteralExpression(optsExpr)) {
		return
	}
	for (const prop of optsExpr.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue
		}
		const key = propertyName(prop.name)
		const value = literalString(prop.initializer)
		if (value === null) {
			continue
		}
		if (key === 'onDelete') {
			fk.onDelete = value
		} else if (key === 'onUpdate') {
			fk.onUpdate = value
		}
	}
}

/**
 * Parse the third callback argument `(t) => ({ pk: primaryKey({...}), ... })`
 * and fold composite PKs, indexes and composite FKs into the table.
 */
function parseTableConfig(
	configArg: ts.Expression,
	propToDbName: Map<string, string>,
	tableName: string,
	filePath: string,
	acc: { primaryKey: string[]; indexes: IndexIR[]; foreignKeys: ForeignKeyIR[] },
	warnings: string[]
): void {
	const obj = configCallbackObject(configArg)
	if (!obj) {
		warnings.push(
			`${filePath}: table "${tableName}" config callback could not be read statically; table-level constraints skipped`
		)
		return
	}

	const entries: ts.Expression[] = []
	if (ts.isObjectLiteralExpression(obj)) {
		for (const prop of obj.properties) {
			if (ts.isPropertyAssignment(prop)) {
				entries.push(prop.initializer)
			}
		}
	} else if (ts.isArrayLiteralExpression(obj)) {
		// Newer drizzle returns an array of builders.
		for (const el of obj.elements) {
			entries.push(el)
		}
	}

	for (const entry of entries) {
		if (!ts.isCallExpression(entry)) {
			continue
		}
		const chain = unwindChain(entry)
		const head = chain.builderName
		if (head === 'primaryKey') {
			const cols = resolvePrimaryKeyArg(chain.baseCall.arguments[0], propToDbName)
			if (cols.length > 0) {
				acc.primaryKey.push(...cols)
			} else {
				warnings.push(
					`${filePath}: table "${tableName}" composite primaryKey columns could not be resolved`
				)
			}
		} else if (head === 'index' || head === 'uniqueIndex') {
			const idx = parseTableIndex(chain, head === 'uniqueIndex', propToDbName, tableName, filePath, warnings)
			if (idx) {
				acc.indexes.push(idx)
			}
		} else if (head === 'foreignKey') {
			const fk = parseCompositeForeignKey(chain.baseCall.arguments[0], chain.modifiers, propToDbName, tableName, filePath, warnings)
			if (fk) {
				acc.foreignKeys.push(fk)
			}
		} else if (head === 'unique') {
			const idx = parseTableIndex(chain, true, propToDbName, tableName, filePath, warnings)
			if (idx) {
				acc.indexes.push(idx)
			}
		}
	}
}

/** Unwrap a `(t) => (...)`/`(t) => { return ... }` callback to its returned expr. */
function configCallbackObject(configArg: ts.Expression): ts.Expression | null {
	let fn: ts.Expression = configArg
	if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) {
		if (ts.isBlock(fn.body)) {
			const ret = fn.body.statements.find(ts.isReturnStatement)
			return ret && ret.expression ? ret.expression : null
		}
		// Arrow with an expression body. Parenthesized object: `(t) => ({...})`.
		let body: ts.Expression = fn.body
		while (ts.isParenthesizedExpression(body)) {
			body = body.expression
		}
		return body
	}
	return null
}

function parseTableIndex(
	chain: TChain,
	unique: boolean,
	propToDbName: Map<string, string>,
	tableName: string,
	filePath: string,
	warnings: string[]
): IndexIR | null {
	// name comes from `index('name')` / `uniqueIndex('name')`.
	let name = literalString(chain.baseCall.arguments[0]) ?? ''
	// columns come from a `.on(t.a, t.b)` modifier.
	const onMod = chain.modifiers.find(function (m) {
		return m.name === 'on'
	})
	const columns = onMod ? resolveColumnArgs(onMod.args, propToDbName) : []
	if (columns.length === 0) {
		warnings.push(
			`${filePath}: table "${tableName}" index columns could not be resolved; index skipped`
		)
		return null
	}
	if (name.length === 0) {
		name = `${tableName}_${columns.join('_')}${unique ? '_unique' : '_idx'}`
	}
	return { name, columns, unique }
}

function parseCompositeForeignKey(
	optsExpr: ts.Expression | undefined,
	modifiers: TModifier[],
	propToDbName: Map<string, string>,
	tableName: string,
	filePath: string,
	warnings: string[]
): ForeignKeyIR | null {
	if (!optsExpr || !ts.isObjectLiteralExpression(optsExpr)) {
		warnings.push(`${filePath}: table "${tableName}" foreignKey() options could not be read; skipped`)
		return null
	}
	let columns: string[] = []
	let refTable: string | null = null
	let refColumns: string[] = []

	for (const prop of optsExpr.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			continue
		}
		const key = propertyName(prop.name)
		if (key === 'columns') {
			columns = resolveColumnArrayLocal(prop.initializer, propToDbName)
		} else if (key === 'foreignColumns') {
			const resolved = resolveForeignColumns(prop.initializer)
			refTable = resolved.table
			refColumns = resolved.columns
		}
	}

	if (columns.length === 0 || refTable === null || refColumns.length === 0) {
		warnings.push(`${filePath}: table "${tableName}" composite foreignKey could not be fully resolved; skipped`)
		return null
	}

	const fk: ForeignKeyIR = { columns, refTable, refColumns }
	const onDelete = modifiers.find(function (m) {
		return m.name === 'onDelete'
	})
	const onUpdate = modifiers.find(function (m) {
		return m.name === 'onUpdate'
	})
	if (onDelete) {
		const v = literalString(onDelete.args[0])
		if (v) fk.onDelete = v
	}
	if (onUpdate) {
		const v = literalString(onUpdate.args[0])
		if (v) fk.onUpdate = v
	}
	return fk
}

/**
 * Resolve the first arg of a table-level `primaryKey(...)` into ordered local
 * DB column names. Supports modern `primaryKey({ columns: [t.a, t.b] })`,
 * a bare `[t.a, t.b]` array, and a single `t.a`.
 */
function resolvePrimaryKeyArg(
	arg: ts.Expression | undefined,
	propToDbName: Map<string, string>
): string[] {
	if (!arg) {
		return []
	}
	if (ts.isObjectLiteralExpression(arg)) {
		for (const prop of arg.properties) {
			if (ts.isPropertyAssignment(prop) && propertyName(prop.name) === 'columns') {
				return resolveColumnArrayLocal(prop.initializer, propToDbName)
			}
		}
		return []
	}
	if (ts.isArrayLiteralExpression(arg)) {
		return resolveColumnArrayLocal(arg, propToDbName)
	}
	const single = localColumnName(arg, propToDbName)
	return single ? [single] : []
}

function resolveColumnArgs(
	args: ts.NodeArray<ts.Expression>,
	propToDbName: Map<string, string>
): string[] {
	const out: string[] = []
	for (const a of args) {
		const name = localColumnName(a, propToDbName)
		if (name) {
			out.push(name)
		}
	}
	return out
}

function resolveColumnArrayLocal(
	expr: ts.Expression,
	propToDbName: Map<string, string>
): string[] {
	if (!ts.isArrayLiteralExpression(expr)) {
		return []
	}
	const out: string[] = []
	for (const el of expr.elements) {
		const name = localColumnName(el, propToDbName)
		if (name) {
			out.push(name)
		}
	}
	return out
}

/** `t.colKey` (or `table.colKey`) → the column's DB name via the prop map. */
function localColumnName(
	expr: ts.Expression,
	propToDbName: Map<string, string>
): string | null {
	if (ts.isPropertyAccessExpression(expr)) {
		const propKey = expr.name.text
		return propToDbName.get(propKey) ?? propKey
	}
	return null
}

/** `[other.a, other.b]` (the referenced table's columns) → table var + columns. */
function resolveForeignColumns(expr: ts.Expression): { table: string | null; columns: string[] } {
	if (!ts.isArrayLiteralExpression(expr)) {
		return { table: null, columns: [] }
	}
	let table: string | null = null
	const columns: string[] = []
	for (const el of expr.elements) {
		if (ts.isPropertyAccessExpression(el) && ts.isIdentifier(el.expression)) {
			table = el.expression.text
			columns.push(el.name.text)
		}
	}
	return { table, columns }
}

function uniqueIndexName(
	args: ts.NodeArray<ts.Expression>,
	tableName: string,
	column: string
): string {
	const explicit = args.length > 0 ? literalString(args[0]) : null
	return explicit ?? `${tableName}_${column}_unique`
}

/**
 * Best-effort normalized text for `.default(x)`. String/number/boolean literals
 * become their text; SQL-template tags and anything non-literal become
 * `'unknown'` so the diff treats them as "review".
 */
function defaultLiteral(args: ts.NodeArray<ts.Expression>): string {
	if (args.length === 0) {
		return 'unknown'
	}
	const arg = args[0]
	if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
		return arg.text
	}
	if (ts.isNumericLiteral(arg)) {
		return arg.text
	}
	if (arg.kind === ts.SyntaxKind.TrueKeyword) {
		return 'true'
	}
	if (arg.kind === ts.SyntaxKind.FalseKeyword) {
		return 'false'
	}
	if (ts.isPrefixUnaryExpression(arg) && ts.isNumericLiteral(arg.operand)) {
		return arg.operator === ts.SyntaxKind.MinusToken ? `-${arg.operand.text}` : arg.operand.text
	}
	if (arg.kind === ts.SyntaxKind.NullKeyword) {
		return 'null'
	}
	// sql`...`, arrays, objects, function calls — not statically comparable.
	return 'unknown'
}

function literalString(node: ts.Expression | undefined): string | null {
	if (!node) {
		return null
	}
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text
	}
	return null
}

function propertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
		return name.text
	}
	return null
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
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

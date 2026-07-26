/**
 * Placeholder converters that satisfy the `DrizzleToSql` / `SqlToDrizzle`
 * contract while the real implementations (#162) land.
 * Everything here is canned and deterministic — the same input always produces
 * the same output — so the UI can be built and tested against a stable surface.
 *
 * Behaviour:
 * - empty / whitespace-only input → `empty-input` failure
 * - input containing `.having(` (Drizzle) or ` HAVING ` (SQL) → an
 *   `unsupported-construct` failure carrying the 1-based line
 * - input mentioning `timestamp` → a canned lossy-mapping warning
 * - anything else → a canned schema or query translation for the dialect
 */

import type {
	ConversionSurface,
	ConvertOptions,
	ConvertResult,
	Dialect
} from '@studio/features/orm-cockpit/converters/contract'

const DRIZZLE_UNSUPPORTED = '.having('
const SQL_UNSUPPORTED = 'having'
const LOSSY_HINT = 'timestamp'

const DIALECT_TABLE_FN: Record<Dialect, string> = {
	postgres: 'pgTable',
	mysql: 'mysqlTable',
	sqlite: 'sqliteTable'
}

const DIALECT_ID_TYPE: Record<Dialect, string> = {
	postgres: 'serial',
	mysql: 'int',
	sqlite: 'integer'
}

const DIALECT_SQL_ID_TYPE: Record<Dialect, string> = {
	postgres: 'serial PRIMARY KEY',
	mysql: 'int AUTO_INCREMENT PRIMARY KEY',
	sqlite: 'integer PRIMARY KEY AUTOINCREMENT'
}

function findLine(source: string, needle: string): number | undefined {
	const lines = source.split('\n')
	const index = lines.findIndex((line) => line.toLowerCase().includes(needle.toLowerCase()))
	return index === -1 ? undefined : index + 1
}

function detectSurface(source: string, options: ConvertOptions): ConversionSurface {
	if (options.surface) {
		return options.surface
	}
	return /\b(pgTable|mysqlTable|sqliteTable|create\s+table|alter\s+table)\b/i.test(source)
		? 'schema'
		: 'query'
}

function warningsFor(source: string, dialect: Dialect): string[] {
	if (!source.toLowerCase().includes(LOSSY_HINT)) {
		return []
	}
	return [
		`timestamp precision is approximated on ${dialect} — review the generated column before applying.`
	]
}

function unsupported(source: string, needle: string, message: string): ConvertResult {
	return {
		ok: false,
		errors: [{ code: 'unsupported-construct', message, line: findLine(source, needle) }]
	}
}

function emptyInput(): ConvertResult {
	return { ok: false, errors: [{ code: 'empty-input', message: 'Nothing to convert yet.' }] }
}

function drizzleSchemaSql(dialect: Dialect): string {
	return [
		'CREATE TABLE "users" (',
		`\t"id" ${DIALECT_SQL_ID_TYPE[dialect]},`,
		'\t"email" text NOT NULL,',
		'\t"created_at" timestamp DEFAULT now() NOT NULL',
		');'
	].join('\n')
}

function drizzleQuerySql(dialect: Dialect): string {
	const placeholder = dialect === 'postgres' ? '$1' : '?'
	return [
		'SELECT "id", "email"',
		'FROM "users"',
		`WHERE "id" = ${placeholder}`,
		'LIMIT 10;'
	].join('\n')
}

function sqlSchemaDrizzle(dialect: Dialect): string {
	const tableFn = DIALECT_TABLE_FN[dialect]
	return [
		`import { ${tableFn}, ${DIALECT_ID_TYPE[dialect]}, text, timestamp } from 'drizzle-orm/${dialect === 'postgres' ? 'pg-core' : dialect === 'mysql' ? 'mysql-core' : 'sqlite-core'}'`,
		'',
		`export const users = ${tableFn}('users', {`,
		`\tid: ${DIALECT_ID_TYPE[dialect]}('id').primaryKey(),`,
		"\temail: text('email').notNull(),",
		"\tcreatedAt: timestamp('created_at').defaultNow().notNull(),",
		'})'
	].join('\n')
}

function sqlQueryDrizzle(dialect: Dialect): string {
	return [
		"import { eq } from 'drizzle-orm'",
		`import { users } from './schema'`,
		'',
		'const rows = await db',
		'\t.select({ id: users.id, email: users.email })',
		'\t.from(users)',
		'\t.where(eq(users.id, 1))',
		'\t.limit(10)',
		`// dialect: ${dialect}`
	].join('\n')
}

export function mockDrizzleToSql(source: string, options: ConvertOptions): ConvertResult {
	if (source.trim().length === 0) {
		return emptyInput()
	}
	if (source.includes(DRIZZLE_UNSUPPORTED)) {
		return unsupported(
			source,
			DRIZZLE_UNSUPPORTED,
			'.having() is not supported by the deterministic converter.'
		)
	}
	const surface = detectSurface(source, options)
	return {
		ok: true,
		surface,
		output:
			surface === 'schema'
				? drizzleSchemaSql(options.dialect)
				: drizzleQuerySql(options.dialect),
		warnings: warningsFor(source, options.dialect)
	}
}

export function mockSqlToDrizzle(source: string, options: ConvertOptions): ConvertResult {
	if (source.trim().length === 0) {
		return emptyInput()
	}
	if (/\bhaving\b/i.test(source)) {
		return unsupported(
			source,
			SQL_UNSUPPORTED,
			'HAVING clauses have no deterministic Drizzle equivalent.'
		)
	}
	const surface = detectSurface(source, options)
	return {
		ok: true,
		surface,
		output:
			surface === 'schema'
				? sqlSchemaDrizzle(options.dialect)
				: sqlQueryDrizzle(options.dialect),
		warnings: warningsFor(source, options.dialect)
	}
}

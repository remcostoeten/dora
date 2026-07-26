/**
 * SQL DDL type token → Drizzle column builder + {@link NormalizedType}.
 *
 * This is the deliberate inverse of two existing tables: `SQL_TYPES` in
 * `migration/generate-sql.ts` (IR → DDL) and `BUILDER_TYPES` in
 * `parsers/drizzle/parse-drizzle-schema.ts` (builder → IR). Keeping the three in
 * sync is what makes `parseDrizzleSchema(convertSqlToDrizzle(ddl))` reproduce the
 * schema the DDL described.
 */

import type { Dialect, NormalizedType } from '@studio/features/orm-cockpit/ir/types'

export type TTypeMapping = {
	/** Drizzle builder name; also stored as `ColumnIR.rawType`. */
	builder: string
	type: NormalizedType
	/** Non-fatal note about a lossy dialect mapping. */
	note?: string
}

type TEntry = { builder: string; type: NormalizedType; note?: string }

const POSTGRES: Record<string, TEntry> = {
	SMALLINT: { builder: 'smallint', type: 'smallint' },
	INT2: { builder: 'smallint', type: 'smallint' },
	INTEGER: { builder: 'integer', type: 'int' },
	INT: { builder: 'integer', type: 'int' },
	INT4: { builder: 'integer', type: 'int' },
	BIGINT: { builder: 'bigint', type: 'bigint' },
	INT8: { builder: 'bigint', type: 'bigint' },
	SMALLSERIAL: { builder: 'smallserial', type: 'smallint' },
	SERIAL2: { builder: 'smallserial', type: 'smallint' },
	SERIAL: { builder: 'serial', type: 'int' },
	SERIAL4: { builder: 'serial', type: 'int' },
	BIGSERIAL: { builder: 'bigserial', type: 'bigint' },
	SERIAL8: { builder: 'bigserial', type: 'bigint' },
	REAL: { builder: 'real', type: 'float' },
	FLOAT4: { builder: 'real', type: 'float' },
	'DOUBLE PRECISION': { builder: 'doublePrecision', type: 'double' },
	FLOAT8: { builder: 'doublePrecision', type: 'double' },
	NUMERIC: { builder: 'numeric', type: 'decimal' },
	DECIMAL: { builder: 'numeric', type: 'decimal' },
	MONEY: {
		builder: 'numeric',
		type: 'decimal',
		note: 'MONEY has no Drizzle builder; emitted numeric()'
	},
	BOOLEAN: { builder: 'boolean', type: 'bool' },
	BOOL: { builder: 'boolean', type: 'bool' },
	TEXT: { builder: 'text', type: 'text' },
	VARCHAR: { builder: 'varchar', type: 'varchar' },
	'CHARACTER VARYING': { builder: 'varchar', type: 'varchar' },
	CHAR: { builder: 'char', type: 'varchar' },
	CHARACTER: { builder: 'char', type: 'varchar' },
	BPCHAR: { builder: 'char', type: 'varchar' },
	UUID: { builder: 'uuid', type: 'uuid' },
	JSON: { builder: 'json', type: 'json' },
	JSONB: { builder: 'jsonb', type: 'jsonb' },
	TIMESTAMP: { builder: 'timestamp', type: 'timestamp' },
	TIMESTAMPTZ: { builder: 'timestamp', type: 'timestamptz' },
	'TIMESTAMP WITH TIME ZONE': { builder: 'timestamp', type: 'timestamptz' },
	'TIMESTAMP WITHOUT TIME ZONE': { builder: 'timestamp', type: 'timestamp' },
	DATE: { builder: 'date', type: 'date' },
	TIME: { builder: 'time', type: 'time' },
	'TIME WITHOUT TIME ZONE': { builder: 'time', type: 'time' },
	'TIME WITH TIME ZONE': { builder: 'time', type: 'time' },
	// drizzle-orm/pg-core ships no bytea builder; text() keeps the schema valid.
	BYTEA: {
		builder: 'text',
		type: 'text',
		note: 'Postgres BYTEA has no drizzle-orm/pg-core builder; emitted text() — define a customType for binary data'
	},
	VECTOR: { builder: 'vector', type: 'vector' }
}

const MYSQL_BLOB_NOTE =
	'MySQL BLOB has no drizzle-orm/mysql-core builder; emitted text() — use varbinary({ length }) or a customType for binary data'

const MYSQL: Record<string, TEntry> = {
	TINYINT: { builder: 'tinyint', type: 'smallint' },
	BOOLEAN: { builder: 'boolean', type: 'bool' },
	BOOL: { builder: 'boolean', type: 'bool' },
	SMALLINT: { builder: 'smallint', type: 'smallint' },
	MEDIUMINT: { builder: 'mediumint', type: 'int' },
	INT: { builder: 'int', type: 'int' },
	INTEGER: { builder: 'int', type: 'int' },
	BIGINT: { builder: 'bigint', type: 'bigint' },
	FLOAT: { builder: 'float', type: 'float' },
	REAL: { builder: 'float', type: 'float' },
	DOUBLE: { builder: 'double', type: 'double' },
	'DOUBLE PRECISION': { builder: 'double', type: 'double' },
	DECIMAL: { builder: 'decimal', type: 'decimal' },
	NUMERIC: { builder: 'decimal', type: 'decimal' },
	VARCHAR: { builder: 'varchar', type: 'varchar' },
	CHAR: { builder: 'char', type: 'varchar' },
	TEXT: { builder: 'text', type: 'text' },
	TINYTEXT: { builder: 'text', type: 'text', note: 'TINYTEXT mapped to text()' },
	MEDIUMTEXT: { builder: 'text', type: 'text', note: 'MEDIUMTEXT mapped to text()' },
	LONGTEXT: { builder: 'text', type: 'text', note: 'LONGTEXT mapped to text()' },
	JSON: { builder: 'json', type: 'json' },
	DATETIME: { builder: 'datetime', type: 'timestamp' },
	TIMESTAMP: { builder: 'timestamp', type: 'timestamp' },
	DATE: { builder: 'date', type: 'date' },
	TIME: { builder: 'time', type: 'time' },
	YEAR: { builder: 'year', type: 'int' },
	// drizzle-orm/mysql-core ships no blob builder; binary/varbinary need a length.
	BLOB: { builder: 'text', type: 'text', note: MYSQL_BLOB_NOTE },
	TINYBLOB: { builder: 'text', type: 'text', note: MYSQL_BLOB_NOTE },
	MEDIUMBLOB: { builder: 'text', type: 'text', note: MYSQL_BLOB_NOTE },
	LONGBLOB: { builder: 'text', type: 'text', note: MYSQL_BLOB_NOTE },
	BINARY: { builder: 'binary', type: 'bytes' },
	VARBINARY: { builder: 'varbinary', type: 'bytes' }
}

const SQLITE: Record<string, TEntry> = {
	INTEGER: { builder: 'integer', type: 'int' },
	INT: { builder: 'integer', type: 'int' },
	BIGINT: {
		builder: 'integer',
		type: 'int',
		note: 'SQLite INTEGER is already 64-bit; BIGINT mapped to integer()'
	},
	SMALLINT: {
		builder: 'integer',
		type: 'int',
		note: 'SQLite has no SMALLINT; mapped to integer()'
	},
	BOOLEAN: {
		builder: 'integer',
		type: 'int',
		note: 'SQLite has no BOOLEAN; mapped to integer()'
	},
	REAL: { builder: 'real', type: 'float' },
	FLOAT: { builder: 'real', type: 'float' },
	DOUBLE: { builder: 'real', type: 'float' },
	NUMERIC: { builder: 'numeric', type: 'decimal' },
	DECIMAL: { builder: 'numeric', type: 'decimal' },
	TEXT: { builder: 'text', type: 'text' },
	VARCHAR: {
		builder: 'text',
		type: 'text',
		note: 'SQLite uses type affinity; VARCHAR mapped to text()'
	},
	CHAR: {
		builder: 'text',
		type: 'text',
		note: 'SQLite uses type affinity; CHAR mapped to text()'
	},
	CLOB: { builder: 'text', type: 'text', note: 'CLOB mapped to text()' },
	DATETIME: {
		builder: 'text',
		type: 'text',
		note: 'SQLite stores DATETIME as TEXT; emitted text()'
	},
	TIMESTAMP: {
		builder: 'text',
		type: 'text',
		note: 'SQLite stores TIMESTAMP as TEXT; emitted text()'
	},
	DATE: { builder: 'text', type: 'text', note: 'SQLite stores DATE as TEXT; emitted text()' },
	BLOB: { builder: 'blob', type: 'bytes' }
}

const TABLES: Record<Dialect, Record<string, TEntry>> = {
	postgres: POSTGRES,
	mysql: MYSQL,
	sqlite: SQLITE
}

/** Words that continue a multi-word type token (`DOUBLE PRECISION`, …). */
const CONTINUATIONS = new Set(['PRECISION', 'VARYING', 'WITH', 'WITHOUT', 'TIME', 'ZONE'])

export function isTypeContinuation(word: string): boolean {
	return CONTINUATIONS.has(word.toUpperCase())
}

/**
 * Resolve a normalized (uppercased, single-spaced) SQL type token. Returns null
 * when the type is not in the closed set — callers decide between a severable
 * warning and a hard failure.
 */
export function mapSqlType(dialect: Dialect, token: string, args: string[]): TTypeMapping | null {
	// MySQL's idiomatic boolean is TINYINT(1); everything else is a small int.
	if (dialect === 'mysql' && token === 'TINYINT' && args[0] === '1') {
		return { builder: 'boolean', type: 'bool' }
	}
	if (dialect === 'mysql' && token === 'CHAR' && args[0] === '36') {
		return { builder: 'char', type: 'varchar' }
	}
	const entry = TABLES[dialect][token]
	if (!entry) {
		return null
	}
	return entry.note
		? { builder: entry.builder, type: entry.type, note: entry.note }
		: { builder: entry.builder, type: entry.type }
}

/** Builders whose presence alone means "auto-incrementing" (Postgres serials). */
export const SERIAL_BUILDERS = new Set(['serial', 'bigserial', 'smallserial'])

/** Type params we carry into the IR, keyed by builder. */
export function typeParamsFor(builder: string, args: string[]): string | undefined {
	if (args.length === 0) {
		return undefined
	}
	if (
		builder === 'varchar' ||
		builder === 'char' ||
		builder === 'binary' ||
		builder === 'varbinary'
	) {
		return args[0]
	}
	if (builder === 'numeric' || builder === 'decimal') {
		return args.slice(0, 2).join(',')
	}
	if (builder === 'vector') {
		return args[0]
	}
	return undefined
}

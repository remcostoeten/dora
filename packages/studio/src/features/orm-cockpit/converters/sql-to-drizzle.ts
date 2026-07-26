/**
 * SQL → Drizzle TypeScript, the deterministic (non-AI) direction of the
 * converter contract (#162). Implements the contract's `SqlToDrizzle` signature.
 *
 * Two surfaces, auto-detected from the leading keyword unless `options.surface`
 * pins one:
 *
 *   SCHEMA — a DDL script (`CREATE TABLE`, `CREATE [UNIQUE] INDEX`,
 *   `ALTER TABLE … ADD`) is parsed into the frozen {@link SchemaIR} and emitted
 *   as `pgTable`/`mysqlTable`/`sqliteTable` declarations. Referenced tables are
 *   declared before the tables that reference them.
 *
 *   QUERY — a single DML statement is parsed into the contract's `QueryIR` and
 *   emitted as a `db.select()/insert()/update()/delete()` chain.
 *
 * Parsing is hand-rolled (lexer + recursive descent) rather than delegated to a
 * SQL-parser dependency: the supported grammar is small and closed, the studio
 * ships in a Tauri bundle where every runtime dependency is weight, and the
 * contract's promises — exact error codes, a line number, byte-identical output
 * for the same input — are exactly the parts a general parser would not give us.
 *
 * This function never throws; failures come back as `ok: false`.
 */

import type {
	ConvertError,
	ConvertOptions,
	ConvertResult,
	ConversionSurface
} from '@studio/features/orm-cockpit/converters/contract'
import type { Dialect } from '@studio/features/orm-cockpit/ir/types'
import {
	SqlConvertError,
	TokenStream,
	tokenize
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-lexer'
import { parseSchemaScript } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-ddl'
import { parseDmlStatement } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-dml'
import { emitSchema } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-emit-schema'
import { emitQuery } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-emit-query'

const DIALECTS: Dialect[] = ['postgres', 'mysql', 'sqlite']

const SCHEMA_KEYWORDS = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'COMMENT']
const QUERY_KEYWORDS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'REPLACE']

/** Implements the contract's `SqlToDrizzle` signature (see `contract.ts`). */
export function convertSqlToDrizzle(source: string, options: ConvertOptions): ConvertResult {
	if (!DIALECTS.includes(options.dialect)) {
		return failure({
			code: 'unsupported-dialect',
			message: `unsupported dialect "${String(options.dialect)}"; expected postgres, mysql or sqlite`
		})
	}
	if (source.trim().length === 0) {
		return failure({ code: 'empty-input', message: 'no SQL to convert' })
	}

	try {
		return convert(source, options)
	} catch (error) {
		if (error instanceof SqlConvertError) {
			return failure({ code: error.code, message: error.message, line: error.line })
		}
		return failure({
			code: 'parse-error',
			message: error instanceof Error ? error.message : String(error)
		})
	}
}

function convert(source: string, options: ConvertOptions): ConvertResult {
	const tokens = tokenize(source, options.dialect)
	const stream = new TokenStream(tokens)

	if (stream.atEof()) {
		return failure({ code: 'empty-input', message: 'the input contains only comments' })
	}

	const surface = options.surface ?? detectSurface(stream)
	if (surface === null) {
		return failure({
			code: 'parse-error',
			message: `could not tell a DDL script from a query; "${stream.peek().value}" starts neither`,
			line: stream.line
		})
	}

	if (surface === 'schema') {
		const plan = parseSchemaScript(stream, options.dialect)
		const emitted = emitSchema(plan)
		return { ok: true, surface, output: emitted.output, warnings: emitted.warnings }
	}

	const parsed = parseDmlStatement(stream, options.dialect)
	const emitted = emitQuery(parsed.query, options.dialect, parsed.warnings)
	return { ok: true, surface, output: emitted.output, warnings: emitted.warnings }
}

function detectSurface(stream: TokenStream): ConversionSurface | null {
	if (stream.isAnyKeyword(SCHEMA_KEYWORDS)) {
		return 'schema'
	}
	if (stream.isAnyKeyword(QUERY_KEYWORDS)) {
		return 'query'
	}
	return null
}

function failure(...errors: ConvertError[]): ConvertResult {
	return { ok: false, errors }
}

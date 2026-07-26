/**
 * Drizzle → SQL, deterministic and AI-free (#162). Implements
 * {@link DrizzleToSql} from the converter contract.
 *
 *   SCHEMA — table definitions are parsed by `parsers/drizzle/parse-drizzle-schema`
 *   into the frozen `SchemaIR` and rendered by the DDL emitters of
 *   `migration/generate-sql`, so DDL output is identical to what the migration
 *   preview would produce.
 *
 *   QUERY — query-builder chains are parsed statically (TypeScript AST, never
 *   executed) into the contract's `QueryIR` and rendered by `emit-sql`.
 *
 * The surface is auto-detected when `options.surface` is omitted: a `db.`/`tx.`
 * chain wins (a snippet may carry its schema alongside the query purely so the
 * converter can resolve JS identifiers onto DB names), otherwise the presence of
 * `pgTable`/`sqliteTable`/`mysqlTable` selects SCHEMA. Nothing throws: every
 * failure comes back as `ok: false` with a coded error.
 */

import ts from 'typescript'
import type {
	ConversionSurface,
	ConvertError,
	ConvertOptions,
	ConvertResult,
	DrizzleToSql,
} from '@studio/features/orm-cockpit/converters/contract'
import { emitSql } from '@studio/features/orm-cockpit/converters/emit-sql'
import {
	emitSchemaSql,
	resolveForeignKeyTables,
} from '@studio/features/orm-cockpit/converters/drizzle-to-sql-schema'
import {
	hasQueryChain,
	parseDrizzleQuery,
} from '@studio/features/orm-cockpit/converters/drizzle-to-sql-query'
import {
	collectTableSymbols,
	hasTableDefinitions,
} from '@studio/features/orm-cockpit/converters/drizzle-to-sql-symbols'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'

const INPUT_PATH = 'input.ts'

/** Implements the contract's {@link DrizzleToSql}. */
export function convertDrizzleToSql(source: string, options: ConvertOptions): ConvertResult {
	if (source.trim().length === 0) {
		return failure({ code: 'empty-input', message: 'nothing to convert' })
	}

	let file: ts.SourceFile
	try {
		file = ts.createSourceFile(INPUT_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	} catch (error) {
		return failure({ code: 'parse-error', message: describeError(error) })
	}

	const syntaxError = firstSyntaxError(file)
	if (syntaxError) {
		return failure(syntaxError)
	}

	const surface = options.surface ?? detectSurface(file)
	if (surface === null) {
		return failure({
			code: 'parse-error',
			message: 'no Drizzle table definitions or query-builder chain were found',
		})
	}

	return surface === 'schema' ? convertSchema(source, options) : convertQuery(file, options)
}

function convertSchema(source: string, options: ConvertOptions): ConvertResult {
	const parsed = parseDrizzleSchema([{ path: INPUT_PATH, text: source }], options.dialect)
	if (parsed.ir.tables.length === 0) {
		return failure({
			code: 'parse-error',
			message: 'no Drizzle table definitions were found',
		})
	}

	const warnings = [...parsed.warnings]
	const file = ts.createSourceFile(INPUT_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
	const ir = resolveForeignKeyTables(parsed.ir, tableNameByVar(file), warnings)
	const output = emitSchemaSql(ir, options.dialect, warnings)

	return { ok: true, surface: 'schema', output, warnings: dedupe(warnings) }
}

function convertQuery(file: ts.SourceFile, options: ConvertOptions): ConvertResult {
	const parsed = parseDrizzleQuery(file)
	if (!parsed.ok) {
		return { ok: false, errors: parsed.errors }
	}
	const warnings = [...parsed.warnings]
	const output = emitSql(parsed.query, options.dialect, warnings)
	return { ok: true, surface: 'query', output, warnings: dedupe(warnings) }
}

function detectSurface(file: ts.SourceFile): ConversionSurface | null {
	if (hasQueryChain(file)) {
		return 'query'
	}
	if (hasTableDefinitions(file)) {
		return 'schema'
	}
	return null
}

function tableNameByVar(file: ts.SourceFile): Map<string, string> {
	const map = new Map<string, string>()
	for (const [varName, symbol] of collectTableSymbols(file)) {
		map.set(varName, symbol.table)
	}
	return map
}

function firstSyntaxError(file: ts.SourceFile): ConvertError | null {
	const diagnostics = (file as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] })
		.parseDiagnostics
	if (!diagnostics || diagnostics.length === 0) {
		return null
	}
	const first = diagnostics[0]
	return {
		code: 'parse-error',
		message: ts.flattenDiagnosticMessageText(first.messageText, ' '),
		line: file.getLineAndCharacterOfPosition(first.start).line + 1,
	}
}

function failure(error: ConvertError): ConvertResult {
	return { ok: false, errors: [error] }
}

function dedupe(warnings: string[]): string[] {
	return Array.from(new Set(warnings))
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

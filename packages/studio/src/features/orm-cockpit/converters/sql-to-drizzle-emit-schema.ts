/**
 * {@link SchemaIR} → idiomatic Drizzle schema TypeScript.
 *
 * The emitted code is the exact input `parsers/drizzle/parse-drizzle-schema`
 * expects, so `parseDrizzleSchema(emitSchema(ir))` reproduces `ir` for every
 * construct both sides model. Output is tab-indented and semicolon-free to match
 * the repo, and byte-stable for a given IR.
 */

import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	TableIR
} from '@studio/features/orm-cockpit/ir/types'
import type { TSchemaPlan } from '@studio/features/orm-cockpit/converters/sql-to-drizzle-ddl'
import {
	camelCase,
	propertyKey,
	quoteString,
	quoteTemplate,
	sortedImportList,
	tableVarName
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-naming'

const CORE_MODULES: Record<Dialect, string> = {
	postgres: 'drizzle-orm/pg-core',
	mysql: 'drizzle-orm/mysql-core',
	sqlite: 'drizzle-orm/sqlite-core'
}

const TABLE_BUILDERS: Record<Dialect, string> = {
	postgres: 'pgTable',
	mysql: 'mysqlTable',
	sqlite: 'sqliteTable'
}

type TEmitContext = {
	dialect: Dialect
	/** table name → (db column name → JS property name). */
	propertyNames: Map<string, Map<string, string>>
	coreImports: Set<string>
	needsSql: boolean
	warnings: string[]
}

export function emitSchema(plan: TSchemaPlan): { output: string; warnings: string[] } {
	const { ir } = plan
	const context: TEmitContext = {
		dialect: ir.dialect,
		propertyNames: buildPropertyNames(ir.tables),
		coreImports: new Set([TABLE_BUILDERS[ir.dialect]]),
		needsSql: false,
		warnings: [...plan.warnings]
	}

	const ordered = orderTables(ir.tables, plan.tableOrder, context.warnings)
	const blocks = ordered.map(function (table) {
		return emitTable(table, plan, context)
	})

	const imports = [
		`import { ${sortedImportList(context.coreImports).join(', ')} } from '${CORE_MODULES[ir.dialect]}'`
	]
	if (context.needsSql) {
		imports.unshift(`import { sql } from 'drizzle-orm'`)
	}

	return {
		output: `${imports.join('\n')}\n\n${blocks.join('\n\n')}\n`,
		warnings: context.warnings
	}
}

function buildPropertyNames(tables: TableIR[]): Map<string, Map<string, string>> {
	const map = new Map<string, Map<string, string>>()
	for (const table of tables) {
		const columns = new Map<string, string>()
		for (const column of table.columns) {
			columns.set(column.name, camelCase(column.name))
		}
		map.set(table.name, columns)
	}
	return map
}

/**
 * Declare referenced tables before the tables that reference them (Kahn's
 * algorithm, declaration order as the tiebreak). Cycles keep declaration order
 * and raise a warning — `.references(() => …)` is lazy so the code still runs.
 */
function orderTables(tables: TableIR[], declarationOrder: string[], warnings: string[]): TableIR[] {
	const byName = new Map(tables.map((table) => [table.name, table]))
	const sequence = declarationOrder.filter((name) => byName.has(name))
	const pending = new Set(sequence)
	const emitted: TableIR[] = []

	while (pending.size > 0) {
		// One table per round, earliest-declared first: dependencies move ahead of
		// their dependents while everything else keeps its source order.
		const next = sequence.find(function (name) {
			if (!pending.has(name)) {
				return false
			}
			const table = byName.get(name) as TableIR
			return table.foreignKeys.every(function (fk) {
				return fk.refTable === name || !pending.has(fk.refTable)
			})
		})
		if (next === undefined) {
			const cyclic = sequence.filter((name) => pending.has(name))
			warnings.push(
				`foreign keys between ${cyclic.join(', ')} form a cycle; tables are emitted in source order`
			)
			for (const name of cyclic) {
				emitted.push(byName.get(name) as TableIR)
			}
			break
		}
		emitted.push(byName.get(next) as TableIR)
		pending.delete(next)
	}

	return emitted
}

function emitTable(table: TableIR, plan: TSchemaPlan, context: TEmitContext): string {
	const order = plan.columnOrder.get(table.name) ?? table.columns.map((column) => column.name)
	const columns = order
		.map(function (name) {
			return table.columns.find((column) => column.name === name)
		})
		.filter(function (column): column is ColumnIR {
			return column !== undefined
		})

	const inlineFks = new Map<string, ForeignKeyIR>()
	for (const fk of table.foreignKeys) {
		if (fk.columns.length === 1 && fk.refColumns.length === 1) {
			inlineFks.set(fk.columns[0], fk)
		}
	}
	const inlineUnique = new Map<string, string>()
	for (const index of table.indexes) {
		if (index.unique && index.columns.length === 1) {
			inlineUnique.set(index.columns[0], index.name)
		}
	}

	const lines = columns.map(function (column) {
		return `\t${emitColumn(table, column, inlineFks.get(column.name), inlineUnique.get(column.name), context)},`
	})

	const config = emitTableConfig(table, inlineFks, inlineUnique, context)
	const head = `export const ${tableVarName(table.name)} = ${TABLE_BUILDERS[context.dialect]}(${quoteString(table.name)}, {`
	const body = lines.join('\n')
	return config.length > 0
		? `${head}\n${body}\n}, (t) => [\n${config.map((entry) => `\t${entry},`).join('\n')}\n])`
		: `${head}\n${body}\n})`
}

function emitColumn(
	table: TableIR,
	column: ColumnIR,
	foreignKey: ForeignKeyIR | undefined,
	uniqueName: string | undefined,
	context: TEmitContext
): string {
	const property = camelCase(column.name)
	const builder = column.rawType
	context.coreImports.add(builder)

	const args: string[] = []
	if (property !== column.name) {
		args.push(quoteString(column.name))
	}
	const options = builderOptions(column, context.dialect)
	if (options) {
		args.push(options)
	}

	const isSinglePk = table.primaryKey.length === 1 && table.primaryKey[0] === column.name
	let chain = `${builder}(${args.join(', ')})`

	if (context.dialect === 'mysql' && column.autoIncrement) {
		chain += '.autoincrement()'
	}
	if (isSinglePk) {
		chain +=
			context.dialect === 'sqlite' && column.autoIncrement
				? '.primaryKey({ autoIncrement: true })'
				: '.primaryKey()'
	} else if (!column.nullable) {
		chain += '.notNull()'
	}
	chain += defaultModifier(column, context)
	if (uniqueName) {
		chain +=
			uniqueName === `${table.name}_${column.name}_unique`
				? '.unique()'
				: `.unique(${quoteString(uniqueName)})`
	}
	if (foreignKey) {
		chain += emitReferences(foreignKey, context)
	}

	return `${propertyKey(property)}: ${chain}`
}

function builderOptions(column: ColumnIR, dialect: Dialect): string | null {
	const builder = column.rawType
	const params = column.typeParams

	if (
		(builder === 'varchar' ||
			builder === 'char' ||
			builder === 'binary' ||
			builder === 'varbinary') &&
		params
	) {
		return `{ length: ${params} }`
	}
	if ((builder === 'numeric' || builder === 'decimal') && params) {
		const [precision, scale] = params.split(',')
		return scale
			? `{ precision: ${precision}, scale: ${scale} }`
			: `{ precision: ${precision} }`
	}
	if (builder === 'vector' && params) {
		return `{ dimensions: ${params} }`
	}
	if ((builder === 'bigint' || builder === 'bigserial') && dialect !== 'sqlite') {
		return `{ mode: 'number' }`
	}
	if (dialect === 'postgres' && builder === 'timestamp' && column.type === 'timestamptz') {
		return '{ withTimezone: true }'
	}
	return null
}

const STRINGY = new Set([
	'text',
	'varchar',
	'uuid',
	'json',
	'jsonb',
	'date',
	'time',
	'decimal',
	'bytes'
])
const NUMERIC = new Set(['int', 'bigint', 'smallint', 'float', 'double'])

function defaultModifier(column: ColumnIR, context: TEmitContext): string {
	const value = column.default
	if (value === null) {
		return ''
	}
	if (value === 'now()') {
		return '.defaultNow()'
	}
	if (value === 'gen_random_uuid()' && context.dialect === 'postgres') {
		return '.defaultRandom()'
	}
	if (column.type === 'bool') {
		const truthy = value === 'true' || value === '1'
		const falsy = value === 'false' || value === '0'
		if (truthy || falsy) {
			return `.default(${truthy})`
		}
	}
	if (NUMERIC.has(column.type) && /^-?\d+(\.\d+)?$/.test(value)) {
		return `.default(${value})`
	}
	if (STRINGY.has(column.type)) {
		return `.default(${quoteString(value)})`
	}
	context.needsSql = true
	return `.default(sql\`${quoteTemplate(value)}\`)`
}

function emitReferences(fk: ForeignKeyIR, context: TEmitContext): string {
	const target = referenceExpression(fk.refTable, fk.refColumns[0], context)
	const options = fkOptions(fk)
	return `.references(() => ${target}${options})`
}

function referenceExpression(tableName: string, columnName: string, context: TEmitContext): string {
	const columns = context.propertyNames.get(tableName)
	if (!columns) {
		context.warnings.push(
			`foreign key targets "${tableName}", which is not created in this script; the emitted code assumes a "${tableVarName(tableName)}" export is in scope`
		)
		return `${tableVarName(tableName)}.${camelCase(columnName)}`
	}
	return `${tableVarName(tableName)}.${columns.get(columnName) ?? camelCase(columnName)}`
}

function fkOptions(fk: ForeignKeyIR): string {
	const parts: string[] = []
	if (fk.onDelete) {
		parts.push(`onDelete: ${quoteString(fk.onDelete)}`)
	}
	if (fk.onUpdate) {
		parts.push(`onUpdate: ${quoteString(fk.onUpdate)}`)
	}
	return parts.length > 0 ? `, { ${parts.join(', ')} }` : ''
}

function emitTableConfig(
	table: TableIR,
	inlineFks: Map<string, ForeignKeyIR>,
	inlineUnique: Map<string, string>,
	context: TEmitContext
): string[] {
	const entries: string[] = []

	if (table.primaryKey.length > 1) {
		context.coreImports.add('primaryKey')
		entries.push(`primaryKey({ columns: [${table.primaryKey.map(local).join(', ')}] })`)
	}

	for (const fk of table.foreignKeys) {
		if (inlineFks.get(fk.columns[0]) === fk) {
			continue
		}
		context.coreImports.add('foreignKey')
		const foreignColumns = fk.refColumns.map(function (column) {
			return referenceExpression(fk.refTable, column, context)
		})
		let entry = `foreignKey({ columns: [${fk.columns.map(local).join(', ')}], foreignColumns: [${foreignColumns.join(', ')}] })`
		if (fk.onDelete) {
			entry += `.onDelete(${quoteString(fk.onDelete)})`
		}
		if (fk.onUpdate) {
			entry += `.onUpdate(${quoteString(fk.onUpdate)})`
		}
		entries.push(entry)
	}

	for (const index of table.indexes) {
		if (
			index.unique &&
			index.columns.length === 1 &&
			inlineUnique.get(index.columns[0]) === index.name
		) {
			continue
		}
		const builder = index.unique ? 'uniqueIndex' : 'index'
		context.coreImports.add(builder)
		entries.push(
			`${builder}(${quoteString(index.name)}).on(${index.columns.map(local).join(', ')})`
		)
	}

	return entries
}

function local(columnName: string): string {
	return `t.${camelCase(columnName)}`
}

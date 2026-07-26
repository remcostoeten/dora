/**
 * SCHEMA surface of the Drizzle→SQL converter: a {@link SchemaIR} (produced by
 * `parsers/drizzle/parse-drizzle-schema`) rendered as DDL. The dialect-correct
 * emission rules are NOT re-implemented here — they are imported from
 * `migration/generate-sql`, which stays the single source of truth for quoting,
 * type tokens, SERIAL/AUTOINCREMENT and foreign-key placement.
 */

import type { Dialect, SchemaIR, TableIR } from '@studio/features/orm-cockpit/ir/types'
import {
	addForeignKeySql,
	buildCreateTableSql,
	createIndexSql,
} from '@studio/features/orm-cockpit/migration/generate-sql'

/**
 * Render every table of `ir` as `CREATE TABLE`, then its indexes, then its
 * foreign keys (SQLite inlines those into the CREATE instead). Blocks are
 * ordered creates → indexes → FKs so referenced tables always exist first.
 */
export function emitSchemaSql(ir: SchemaIR, dialect: Dialect, warnings: string[]): string {
	const inlineFks = dialect === 'sqlite'
	const creates: string[] = []
	const indexes: string[] = []
	const foreignKeys: string[] = []

	for (const table of ir.tables) {
		creates.push(
			buildCreateTableSql(
				table.name,
				table.columns,
				table.primaryKey,
				dialect,
				inlineFks ? table.foreignKeys : [],
				warnings,
			),
		)
		for (const idx of table.indexes) {
			indexes.push(createIndexSql(table.name, idx, dialect))
		}
		if (!inlineFks) {
			for (const fk of table.foreignKeys) {
				foreignKeys.push(addForeignKeySql(table.name, fk, dialect))
			}
		}
	}

	const blocks: string[] = []
	if (creates.length > 0) {
		blocks.push(creates.join('\n\n'))
	}
	if (indexes.length > 0) {
		blocks.push(indexes.join('\n'))
	}
	if (foreignKeys.length > 0) {
		blocks.push(foreignKeys.join('\n'))
	}
	return blocks.join('\n\n')
}

/**
 * Rewrite foreign-key `refTable` values that still hold the Drizzle *variable*
 * name (the parser resolves `() => users.id` to the JS identifier) into the DB
 * table name, using the variable→table map collected from the same source.
 */
export function resolveForeignKeyTables(
	ir: SchemaIR,
	varToTable: Map<string, string>,
	warnings: string[],
): SchemaIR {
	const known = new Set(ir.tables.map((t) => t.name))
	const tables: TableIR[] = ir.tables.map(function (table) {
		return {
			...table,
			foreignKeys: table.foreignKeys.map(function (fk) {
				if (known.has(fk.refTable)) {
					return fk
				}
				const resolved = varToTable.get(fk.refTable)
				if (resolved) {
					return { ...fk, refTable: resolved }
				}
				warnings.push(
					`table "${table.name}": foreign key references "${fk.refTable}", which is not defined in this snippet; emitted as-is.`,
				)
				return fk
			}),
		}
	})
	return { dialect: ir.dialect, tables }
}

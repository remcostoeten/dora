/**
 * Filter out tables that a code schema will never contain, so they don't flood
 * the diff as bogus "drop from DB" (destructive) noise. Two sources of noise on
 * a real database:
 *
 *   1. Migration bookkeeping tables the ORM tooling owns
 *      (`__drizzle_migrations`, `_prisma_migrations`).
 *   2. Provider/system schemas (Supabase `auth`/`storage`, Postgres internals,
 *      extensions, …) — present on the live DB but never in your `schema.ts`.
 *
 * Hidden by default with a UI toggle to reveal them. Pure and dialect-aware so
 * it can be unit-tested and applied to the live IR before diffing (which also
 * means generated migrations never try to drop these tables).
 */

import type { Dialect, SchemaIR, TableIR } from '@studio/features/orm-cockpit/ir/types'

/** ORM migration-history tables — owned by the CLI, not your schema. */
const MANAGED_TABLE_NAMES = new Set(['__drizzle_migrations', '_prisma_migrations'])

/**
 * Schemas owned by the platform/extensions rather than the application. Mostly
 * Postgres/Supabase; matching is case-insensitive. `public` is always yours.
 */
const SYSTEM_SCHEMAS = new Set([
	'pg_catalog',
	'pg_toast',
	'information_schema',
	// Supabase / common extensions.
	'auth',
	'storage',
	'graphql',
	'graphql_public',
	'realtime',
	'_realtime',
	'vault',
	'pgsodium',
	'pgsodium_masks',
	'extensions',
	'cron',
	'net',
	'supabase_functions',
	'supabase_migrations',
	'_analytics',
])

export function isManagedTable(table: TableIR, dialect: Dialect): boolean {
	if (MANAGED_TABLE_NAMES.has(table.name)) {
		return true
	}
	if (dialect === 'postgres' && table.schema) {
		return SYSTEM_SCHEMAS.has(table.schema.toLowerCase())
	}
	return false
}

/**
 * Drop managed/system tables from an IR. When `show` is true this is a no-op,
 * so callers can wire it straight to a toggle.
 */
export function filterManagedTables(ir: SchemaIR, dialect: Dialect, show: boolean): SchemaIR {
	if (show) {
		return ir
	}
	return {
		...ir,
		tables: ir.tables.filter(function (table) {
			return !isManagedTable(table, dialect)
		}),
	}
}

/** Count of managed/system tables in an IR (for the "N hidden" toggle label). */
export function countManagedTables(ir: SchemaIR, dialect: Dialect): number {
	return ir.tables.filter(function (table) {
		return isManagedTable(table, dialect)
	}).length
}

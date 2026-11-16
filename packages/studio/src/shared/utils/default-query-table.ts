// Bookkeeping tables written by migration tools and engines, never by the user.
const INTERNAL_TABLE_PATTERN =
	/^(__drizzle|_prisma_migrations$|__diesel_schema_migrations$|__efmigrationshistory$|_sqlx_migrations$|_cf_|d1_migrations$|sqlite_|schema_migrations$|ar_internal_metadata$|knex_migrations|flyway_schema_history$|django_migrations$|alembic_version$|goose_db_version$|atlas_schema_revisions$|migrations$|databasechangelog)/i

export function isInternalQueryTable(name: string): boolean {
	return INTERNAL_TABLE_PATTERN.test(name.trim())
}

export function pickDefaultQueryTable<T extends { name: string }>(tables: T[]): T | undefined {
	if (tables.length === 0) return undefined

	const preferred = tables.find(function (table) {
		return !isInternalQueryTable(table.name)
	})

	return preferred ?? tables[0]
}

export function buildDefaultSqlQuery(tableName: string): string {
	return `SELECT * FROM ${tableName} LIMIT 100;`
}

export function buildDefaultDrizzleQuery(tableName: string): string {
	return `db.select().from(${tableName}).limit(100);`
}

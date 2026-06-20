import type { Dialect, NormalizedType } from '@studio/features/orm-cockpit/ir/types'

/**
 * Map a raw DB/ORM type string to the small canonical {@link NormalizedType}
 * set so semantically-equal columns don't surface as drift.
 *
 * Design rule (the single most important call in Pillar 2): bias to
 * `'unknown'` over guessing. Anything not confidently recognized returns
 * `'unknown'`, which the diff engine (plan 05) treats as "review" rather than
 * emitting a confident — and possibly destructive — ALTER. So it is always
 * safe to leave a type out of this map; it is never safe to map it wrong.
 *
 * Matching is substring-based (raw types carry length/precision noise like
 * `varchar(255)`, `numeric(10,2)`, `timestamp(6) with time zone`) and the
 * checks are ordered most-specific-first (`bigint` before `int`, `jsonb`
 * before `json`, `timestamptz` before `timestamp`, `timestamp` before `time`).
 *
 * Vocabulary cross-checked against the reverse mapping in
 * `apps/desktop/src-tauri/src/database/services/schema_export.rs`
 * (`get_drizzle_type`), which is what the live DB emits for pg/sqlite.
 */
export function normalizeDbType(rawType: string, dialect: Dialect): NormalizedType {
	const t = rawType.trim().toLowerCase()
	if (t.length === 0) {
		return 'unknown'
	}

	switch (dialect) {
		case 'postgres':
			return normalizePostgres(t)
		case 'mysql':
			return normalizeMysql(t)
		case 'sqlite':
			return normalizeSqlite(t)
		default:
			return 'unknown'
	}
}

function has(t: string, needle: string): boolean {
	return t.includes(needle)
}

function normalizePostgres(t: string): NormalizedType {
	if (has(t, 'bool')) return 'bool'
	if (has(t, 'uuid')) return 'uuid'
	if (has(t, 'jsonb')) return 'jsonb'
	if (has(t, 'json')) return 'json'

	// Integers: serial is a default-bearing alias for the int family.
	if (has(t, 'bigserial') || has(t, 'int8') || has(t, 'bigint')) return 'bigint'
	if (has(t, 'smallserial') || has(t, 'smallint') || has(t, 'int2')) return 'smallint'
	if (has(t, 'serial') || has(t, 'int4') || has(t, 'integer') || has(t, 'int')) return 'int'

	if (has(t, 'numeric') || has(t, 'decimal') || has(t, 'money')) return 'decimal'
	if (has(t, 'double') || has(t, 'float8')) return 'double'
	if (has(t, 'real') || has(t, 'float4') || has(t, 'float')) return 'float'

	// timestamp/time variants: time-zone and "timestamp" must win over "time".
	if (has(t, 'timestamptz') || has(t, 'timestamp with time zone')) return 'timestamptz'
	if (has(t, 'timestamp')) return 'timestamp'
	if (has(t, 'date')) return 'date'
	if (has(t, 'time')) return 'time'

	if (has(t, 'bytea')) return 'bytes'
	if (has(t, 'varchar') || has(t, 'character varying')) return 'varchar'
	if (has(t, 'char') || has(t, 'bpchar')) return 'varchar'
	if (has(t, 'text')) return 'text'

	return 'unknown'
}

function normalizeMysql(t: string): NormalizedType {
	// MySQL has no boolean type; tinyint(1) is the idiomatic boolean.
	if (has(t, 'tinyint(1)')) return 'bool'
	if (has(t, 'bool')) return 'bool'

	if (has(t, 'bigint')) return 'bigint'
	if (has(t, 'smallint') || has(t, 'tinyint') || has(t, 'mediumint')) return 'smallint'
	if (has(t, 'int')) return 'int'

	if (has(t, 'decimal') || has(t, 'numeric')) return 'decimal'
	if (has(t, 'double')) return 'double'
	if (has(t, 'float') || has(t, 'real')) return 'float'

	// MySQL has only `json` (no jsonb).
	if (has(t, 'json')) return 'json'

	if (has(t, 'datetime') || has(t, 'timestamp')) return 'timestamp'
	if (has(t, 'date')) return 'date'
	if (has(t, 'time')) return 'time'
	if (has(t, 'year')) return 'int'

	if (has(t, 'blob') || has(t, 'binary')) return 'bytes'
	if (has(t, 'varchar')) return 'varchar'
	if (has(t, 'char')) return 'varchar'
	if (has(t, 'text') || has(t, 'enum')) return 'text'

	return 'unknown'
}

function normalizeSqlite(t: string): NormalizedType {
	// SQLite uses type affinity; raw type strings are still informative but
	// loosely defined, so stay conservative.
	if (has(t, 'bool')) return 'bool'

	if (has(t, 'bigint')) return 'bigint'
	if (has(t, 'int')) return 'int'

	if (has(t, 'numeric') || has(t, 'decimal')) return 'decimal'
	if (has(t, 'double')) return 'double'
	if (has(t, 'real') || has(t, 'float')) return 'float'

	if (has(t, 'timestamp') || has(t, 'datetime')) return 'timestamp'
	if (has(t, 'date')) return 'date'
	if (has(t, 'time')) return 'time'

	if (has(t, 'blob')) return 'bytes'
	if (has(t, 'char') || has(t, 'clob') || has(t, 'text')) return 'text'

	return 'unknown'
}

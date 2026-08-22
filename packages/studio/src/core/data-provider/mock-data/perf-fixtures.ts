import type {
	ColumnInfo,
	DatabaseSchema,
	IndexInfo,
	SavedQuery,
	TableInfo
} from '@studio/lib/bindings'
import type { MockConnection } from './connections'

/**
 * Large deterministic fixtures for the performance harness
 * (`src/test/performance/`): a 200-table / 2,000-column schema, a 100k-row
 * table, 10 connections and 50 saved queries.
 *
 * Generated, never committed as data — every value comes from a seeded PRNG, so
 * two runs on two machines produce byte-identical fixtures and a baseline stays
 * comparable.
 *
 * Opt-in only. Nothing here loads unless `?perf=1` is in the URL or
 * `dora_perf_fixtures` is `"1"` in localStorage, so the shipped demo dataset is
 * untouched.
 */

export const PERF_CONNECTION_COUNT = 10
export const PERF_TABLE_COUNT = 200
export const PERF_COLUMN_COUNT = 2000
export const PERF_SCRIPT_COUNT = 50
export const PERF_LARGE_ROW_COUNT = 100_000

/** The connection the harness drives; index 0 of the generated set. */
export const PERF_PRIMARY_CONNECTION_ID = 'perf-conn-00'
/** The connection used for the connection-switch scenario. */
export const PERF_SECONDARY_CONNECTION_ID = 'perf-conn-01'
/** The 100k-row table, present on the primary connection. */
export const PERF_LARGE_TABLE = 'perf_events'
/** Two small tables used for the cached table-switch scenario. */
export const PERF_SMALL_TABLES = ['perf_accounts', 'perf_regions'] as const

/**
 * A fixed instant so generated timestamps never depend on the wall clock.
 * 2025-01-01T00:00:00Z.
 */
const EPOCH = 1_735_689_600_000

/** mulberry32 — small, fast, and identical across engines for a given seed. */
function createRandom(seed: number): () => number {
	let state = seed >>> 0
	return function next() {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function pick<T>(random: () => number, values: readonly T[]): T {
	return values[Math.floor(random() * values.length)] as T
}

function integer(random: () => number, min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1))
}

function column(
	name: string,
	dataType: string,
	options?: Partial<ColumnInfo>
): ColumnInfo {
	return {
		name,
		data_type: dataType,
		is_nullable: true,
		default_value: null,
		is_primary_key: false,
		is_auto_increment: false,
		foreign_key: null,
		...options
	}
}

function primaryKeyIndex(table: string): IndexInfo {
	return {
		name: `${table}_pkey`,
		column_names: ['id'],
		is_unique: true,
		is_primary: true
	}
}

const COLUMN_TYPES = [
	'varchar(255)',
	'text',
	'integer',
	'bigint',
	'numeric(12,2)',
	'boolean',
	'timestamp',
	'jsonb',
	'uuid',
	'date'
] as const

const DOMAINS = [
	'orders',
	'billing',
	'identity',
	'catalog',
	'shipping',
	'analytics',
	'audit',
	'support',
	'inventory',
	'marketing'
] as const

const FACETS = [
	'events',
	'items',
	'history',
	'settings',
	'links',
	'metrics',
	'runs',
	'tags',
	'notes',
	'jobs'
] as const

function idColumn(): ColumnInfo {
	return column('id', 'bigserial', {
		is_nullable: false,
		is_primary_key: true,
		is_auto_increment: true
	})
}

/**
 * The three tables that carry rows describe those rows exactly. A generated
 * column list here would render a grid of NULLs — the grid takes its columns
 * from the schema and its values from the row keys, so the two have to agree.
 */
const SMALL_TABLE_COLUMNS: ColumnInfo[] = [
	idColumn(),
	column('label', 'varchar(64)', { is_nullable: false }),
	column('country', 'char(2)'),
	column('amount_cents', 'integer'),
	column('created_at', 'timestamp', { is_nullable: false })
]

const LARGE_TABLE_COLUMNS: ColumnInfo[] = [
	idColumn(),
	column('event_name', 'varchar(64)', { is_nullable: false }),
	column('user_id', 'integer'),
	column('session_id', 'varchar(32)'),
	column('amount_cents', 'integer'),
	column('currency', 'char(3)'),
	column('country', 'char(2)'),
	column('device', 'varchar(16)'),
	column('duration_ms', 'integer'),
	column('created_at', 'timestamp', { is_nullable: false })
]

/** Columns spoken for by the three data-backed tables. */
const FIXED_COLUMN_COUNT = SMALL_TABLE_COLUMNS.length * 2 + LARGE_TABLE_COLUMNS.length

/**
 * 200 tables carrying 2,000 columns in total. Widths vary from 4 to 40 columns
 * so the schema exercises both the narrow and the wide end of the sidebar and
 * the schema visualizer, rather than 200 identical shapes.
 */
function buildPerfTables(): TableInfo[] {
	const random = createRandom(0x5eed_1)
	const tables: TableInfo[] = []
	const generatedCount = PERF_TABLE_COUNT - 3
	const widths = distributeColumns(
		generatedCount,
		PERF_COLUMN_COUNT - FIXED_COLUMN_COUNT,
		random
	)

	for (let index = 0; index < PERF_TABLE_COUNT; index += 1) {
		const name = perfTableName(index)
		const fixed = fixedColumnsFor(name)
		const columns = fixed ?? generatedColumns(widths[index - 3] as number, random)

		tables.push({
			name,
			schema: 'public',
			columns,
			primary_key_columns: ['id'],
			indexes: [primaryKeyIndex(name)],
			row_count_estimate: integer(random, 100, 250_000)
		})
	}

	return tables
}

function fixedColumnsFor(name: string): ColumnInfo[] | null {
	if (name === PERF_LARGE_TABLE) return LARGE_TABLE_COLUMNS
	if (name === PERF_SMALL_TABLES[0] || name === PERF_SMALL_TABLES[1]) {
		return SMALL_TABLE_COLUMNS
	}
	return null
}

function generatedColumns(width: number, random: () => number): ColumnInfo[] {
	const columns: ColumnInfo[] = [idColumn()]
	for (let index = 1; index < width; index += 1) {
		columns.push(
			column(
				`col_${String(index).padStart(3, '0')}_${pick(random, FACETS)}`,
				pick(random, COLUMN_TYPES)
			)
		)
	}
	return columns
}

/**
 * Splits `total` columns across `count` tables with a deterministic spread,
 * guaranteeing the exact total and a minimum width of 4.
 */
function distributeColumns(count: number, total: number, random: () => number): number[] {
	const minimum = 4
	const widths = Array.from({ length: count }, function atMinimum() {
		return minimum
	})
	let remaining = total - minimum * count

	for (let index = 0; index < count && remaining > 0; index += 1) {
		const share = Math.min(remaining, integer(random, 0, 36))
		widths[index] = minimum + share
		remaining -= share
	}

	let cursor = 0
	while (remaining > 0) {
		widths[cursor % count] = (widths[cursor % count] as number) + 1
		remaining -= 1
		cursor += 1
	}

	return widths
}

/**
 * The small tables come first on purpose: the sidebar auto-selects
 * `tables[0]` when a connection is opened, and a connection switch should be
 * measured against a cheap table rather than against 100k rows.
 */
function perfTableName(index: number): string {
	if (index === 0) return PERF_SMALL_TABLES[0]
	if (index === 1) return PERF_SMALL_TABLES[1]
	if (index === 2) return PERF_LARGE_TABLE
	const domain = DOMAINS[index % DOMAINS.length]
	const facet = FACETS[Math.floor(index / DOMAINS.length) % FACETS.length]
	return `${domain}_${facet}_${String(index).padStart(3, '0')}`
}

export function buildPerfConnections(): MockConnection[] {
	const random = createRandom(0x5eed_2)
	const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
	const connections: MockConnection[] = []

	for (let index = 0; index < PERF_CONNECTION_COUNT; index += 1) {
		const id = `perf-conn-${String(index).padStart(2, '0')}`
		connections.push({
			id,
			name: `Perf Fixture ${String(index).padStart(2, '0')} (PostgreSQL)`,
			connected: index === 0,
			database_type: {
				Postgres: {
					connection_string: `postgresql://perf:perf@localhost:5432/perf_${index}`,
					ssh_config: null
				}
			},
			last_connected_at: EPOCH - index * 3_600_000,
			created_at: EPOCH - 86_400_000 * (index + 1),
			updated_at: EPOCH - index * 3_600_000,
			pin_hash: null,
			favorite: index < 2,
			color: colors[index % colors.length] as string,
			sort_order: 100 + index
		})
	}

	// Touch the PRNG once per connection so future field additions stay stable.
	random()
	return connections
}

/**
 * Every perf connection shares one generated schema object. The adapter only
 * reads it, and sharing keeps 10 connections from costing 10× the memory of a
 * 2,000-column schema.
 */
export function buildPerfSchemas(): Record<string, DatabaseSchema> {
	const tables = buildPerfTables()
	const schemas: Record<string, DatabaseSchema> = {}

	for (const connection of buildPerfConnections()) {
		schemas[connection.id] = {
			tables,
			schemas: ['public'],
			unique_columns: ['id']
		}
	}

	return schemas
}

const EVENT_NAMES = [
	'checkout_completed',
	'cart_updated',
	'session_started',
	'page_viewed',
	'signup_submitted',
	'invoice_paid',
	'refund_issued',
	'search_performed'
] as const

const COUNTRIES = ['NL', 'DE', 'US', 'GB', 'FR', 'ES', 'JP', 'BR'] as const
const DEVICES = ['desktop', 'mobile', 'tablet'] as const

/**
 * Rows shaped like `LARGE_TABLE_COLUMNS`. The primary connection gets the full
 * 100k for budget 5; the secondary gets a small one so a connection switch has
 * something of the same shape to paint.
 */
function buildLargeTableRows(
	seed: number,
	count: number,
	prefix: string
): Record<string, unknown>[] {
	const random = createRandom(seed)

	return Array.from({ length: count }, function buildRow(_unused, index) {
		return {
			id: index + 1,
			event_name: `${prefix}-${pick(random, EVENT_NAMES)}`,
			user_id: integer(random, 1, 5_000),
			session_id: `sess-${integer(random, 1, 9_000)}`,
			amount_cents: integer(random, 0, 250_000),
			currency: 'EUR',
			country: pick(random, COUNTRIES),
			device: pick(random, DEVICES),
			duration_ms: integer(random, 4, 30_000),
			created_at: EPOCH + index * 1_000
		}
	})
}

/**
 * `prefix` makes every connection's rows visibly its own. The harness detects a
 * connection switch by watching the first cell change, and with only ten domain
 * words two connections collide on row 0 often enough to break that.
 */
function buildSmallTableRows(
	seed: number,
	count: number,
	prefix: string
): Record<string, unknown>[] {
	const random = createRandom(seed)
	const rows: Record<string, unknown>[] = []

	for (let index = 0; index < count; index += 1) {
		rows.push({
			id: index + 1,
			label: `${prefix}-${pick(random, DOMAINS)}-${String(index).padStart(4, '0')}`,
			country: pick(random, COUNTRIES),
			amount_cents: integer(random, 0, 100_000),
			created_at: EPOCH + index * 60_000
		})
	}

	return rows
}

/**
 * Row data for the tables the harness actually reads. The other ~195 tables
 * exist in the schema only — they make the sidebar and the schema payload
 * realistic without paying for rows nothing scrolls.
 *
 * Both harness connections carry the same three tables so a connection switch
 * paints comparable work on either side; only the primary carries the 100k
 * rows.
 */
export function buildPerfTableData(): Record<string, Record<string, unknown>[]> {
	return {
		[`${PERF_PRIMARY_CONNECTION_ID}:${PERF_LARGE_TABLE}`]: buildLargeTableRows(
			0x5eed_3,
			PERF_LARGE_ROW_COUNT,
			'c00'
		),
		[`${PERF_PRIMARY_CONNECTION_ID}:${PERF_SMALL_TABLES[0]}`]: buildSmallTableRows(
			0x5eed_4,
			500,
			'c00-acct'
		),
		[`${PERF_PRIMARY_CONNECTION_ID}:${PERF_SMALL_TABLES[1]}`]: buildSmallTableRows(
			0x5eed_5,
			500,
			'c00-regn'
		),
		[`${PERF_SECONDARY_CONNECTION_ID}:${PERF_LARGE_TABLE}`]: buildLargeTableRows(
			0x5eed_9,
			2_000,
			'c01'
		),
		[`${PERF_SECONDARY_CONNECTION_ID}:${PERF_SMALL_TABLES[0]}`]: buildSmallTableRows(
			0x5eed_6,
			500,
			'c01-acct'
		),
		[`${PERF_SECONDARY_CONNECTION_ID}:${PERF_SMALL_TABLES[1]}`]: buildSmallTableRows(
			0x5eed_7,
			500,
			'c01-regn'
		)
	}
}

const SCRIPT_CATEGORIES = ['Reports', 'Analysis', 'Maintenance', 'Ad hoc', 'Exports'] as const

export function buildPerfScripts(): SavedQuery[] {
	const random = createRandom(0x5eed_8)
	const scripts: SavedQuery[] = []

	for (let index = 0; index < PERF_SCRIPT_COUNT; index += 1) {
		const domain = pick(random, DOMAINS)
		const connectionIndex = index % PERF_CONNECTION_COUNT
		scripts.push({
			id: 1_000 + index,
			name: `Perf script ${String(index).padStart(2, '0')} — ${domain}`,
			description: `Generated perf fixture query ${index}`,
			query_text: `SELECT country, count(*) AS total\nFROM ${PERF_LARGE_TABLE}\nWHERE amount_cents > ${index * 100}\nGROUP BY country\nORDER BY total DESC\nLIMIT ${integer(random, 10, 500)};`,
			connection_id:
				index % 3 === 0 ? null : `perf-conn-${String(connectionIndex).padStart(2, '0')}`,
			tags: `perf,${domain}`,
			category: pick(random, SCRIPT_CATEGORIES),
			created_at: EPOCH - index * 60_000,
			updated_at: EPOCH - index * 30_000,
			favorite: index % 7 === 0,
			is_snippet: true,
			is_system: false,
			language: 'sql',
			folder_id: null
		})
	}

	return scripts
}

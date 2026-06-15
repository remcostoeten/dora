import { DatabaseType } from '../types'

/**
 * Provider metadata including defaults and URL patterns
 */
export type ProviderConfig = {
	/** Display name */
	name: string
	/** Default port */
	defaultPort: number
	/** Default username */
	defaultUser: string
	/** Default database name */
	defaultDatabase: string
	/** URL protocol(s) */
	protocols: string[]
	/** Whether SSL is supported */
	supportsSSL: boolean
}

/**
 * Provider detection patterns based on hostname
 */
export type ProviderPattern = {
	/** Hostname pattern to match */
	pattern: RegExp | string
	/** Display name for detected provider */
	displayName: string
	/** Provider type (optional). Leave undefined to let the URL protocol/port decide the engine. */
	type?: DatabaseType
	/**
	 * When true and the connection URL has no explicit `sslmode`/`ssl` query param,
	 * `parseConnectionUrl` defaults `ssl` to true for this provider.
	 */
	requiresSsl?: boolean
}

/**
 * Centralized provider configurations
 */
export const PROVIDER_CONFIGS: Record<DatabaseType, ProviderConfig> = {
	postgres: {
		name: 'PostgreSQL',
		defaultPort: 5432,
		defaultUser: 'postgres',
		defaultDatabase: 'postgres',
		protocols: ['postgresql', 'postgres'],
		supportsSSL: true
	},
	cockroach: {
		name: 'CockroachDB',
		defaultPort: 26257,
		defaultUser: 'root',
		defaultDatabase: 'defaultdb',
		protocols: ['postgresql', 'postgres'],
		supportsSSL: true
	},
	mysql: {
		name: 'MySQL',
		defaultPort: 3306,
		defaultUser: 'root',
		defaultDatabase: 'mysql',
		protocols: ['mysql'],
		supportsSSL: true
	},
	mariadb: {
		name: 'MariaDB',
		defaultPort: 3306,
		defaultUser: 'root',
		defaultDatabase: 'mysql',
		protocols: ['mysql'],
		supportsSSL: true
	},
	sqlite: {
		name: 'SQLite',
		defaultPort: 0,
		defaultUser: '',
		defaultDatabase: '',
		protocols: ['sqlite'],
		supportsSSL: false
	},
	duckdb: {
		name: 'DuckDB',
		defaultPort: 0,
		defaultUser: '',
		defaultDatabase: '',
		protocols: ['duckdb'],
		supportsSSL: false
	},
	libsql: {
		name: 'LibSQL',
		defaultPort: 0,
		defaultUser: '',
		defaultDatabase: '',
		protocols: ['libsql'],
		supportsSSL: false
	}
}

/**
 * Known provider patterns for auto-detection
 */
export const PROVIDER_PATTERNS: ProviderPattern[] = [
	// --- Postgres-wire managed providers (TLS required) ---
	{ pattern: /supabase\.(co|com)/, displayName: 'Supabase DB', type: 'postgres', requiresSsl: true },
	{ pattern: 'neon.tech', displayName: 'Neon DB', type: 'postgres', requiresSsl: true },
	// Vercel Postgres (Neon-backed)
	{ pattern: /vercel-storage\.com|prisma-data/, displayName: 'Vercel Postgres', type: 'postgres', requiresSsl: true },
	{ pattern: 'render.com', displayName: 'Render DB', type: 'postgres', requiresSsl: true },
	{ pattern: 'postgresbridge.com', displayName: 'Crunchy Bridge', type: 'postgres', requiresSsl: true },
	{ pattern: /tsdb\.cloud\.timescale\.com|timescaledb/, displayName: 'Timescale Cloud', type: 'postgres', requiresSsl: true },
	{ pattern: /yugabyte\.cloud|ybdb/, displayName: 'Yugabyte', type: 'postgres', requiresSsl: true },

	{ pattern: /fly\.dev|flympg/, displayName: 'Fly.io Postgres', type: 'postgres', requiresSsl: true },

	// --- Dual-engine managed providers (engine decided by protocol/port) ---
	// Railway private network has no TLS; public endpoints require it.
	{ pattern: 'railway.internal', displayName: 'Railway DB', requiresSsl: false },
	{ pattern: /railway\.app|rlwy\.net|containers-us-west/, displayName: 'Railway DB', requiresSsl: true },
	{ pattern: 'aivencloud.com', displayName: 'Aiven DB', requiresSsl: true },
	// Azure split by engine (must precede any generic azure match).
	{ pattern: 'postgres.database.azure.com', displayName: 'Azure Database for PostgreSQL', type: 'postgres', requiresSsl: true },
	{ pattern: 'mysql.database.azure.com', displayName: 'Azure Database for MySQL', type: 'mysql', requiresSsl: true },
	{ pattern: 'azure', displayName: 'Azure DB', requiresSsl: true },
	{ pattern: /db\.ondigitalocean\.com|ondigitalocean\.com/, displayName: 'DigitalOcean DB', requiresSsl: true },
	// AWS RDS / Aurora — SSL optional; do not force it.
	{ pattern: 'rds.amazonaws.com', displayName: 'AWS RDS', requiresSsl: false },
	{ pattern: /aws.*rds/, displayName: 'AWS RDS', requiresSsl: false },

	// --- MySQL-wire managed providers ---
	{ pattern: 'planetscale', displayName: 'PlanetScale DB', type: 'mysql', requiresSsl: true },
	{ pattern: /psdb\.cloud|connect\.psdb\.cloud/, displayName: 'PlanetScale DB', type: 'mysql', requiresSsl: true },
	{ pattern: 'tidbcloud.com', displayName: 'TiDB Cloud', type: 'mysql', requiresSsl: true },

	// --- CockroachDB Cloud (cockroach dialect, TLS required) ---
	// Must precede the broad gcp/google and cockroach engine patterns: cloud hostnames
	// embed substrings like "gcp" and "cockroach".
	{ pattern: 'cockroachlabs.cloud', displayName: 'CockroachDB Cloud', type: 'cockroach', requiresSsl: true },

	// --- libSQL ---
	{ pattern: /turso\.io|turso\.tech/, displayName: 'Turso DB', type: 'libsql' },

	// --- Self-described engines (broad; must precede Fly's .internal/.flycast catch-all) ---
	{ pattern: /maria(?:db)?/, displayName: 'MariaDB DB', type: 'mariadb' },
	{ pattern: /cockroach(?:db)?|crdb/, displayName: 'CockroachDB', type: 'cockroach' },

	// Google Cloud SQL (broad gcp/google match; after named cloud hosts above).
	{ pattern: /gcp|google.*cloud/, displayName: 'Google Cloud SQL' },

	// Fly.io private network (.internal / .flycast over WireGuard) — no TLS. Kept last
	// so named engine/provider hosts are recognized before this broad suffix match.
	{ pattern: /\.flycast$|\.internal$/, displayName: 'Fly.io Postgres', type: 'postgres', requiresSsl: false }
]

/**
 * Returns the first PROVIDER_PATTERNS entry whose pattern matches the hostname.
 * Order in PROVIDER_PATTERNS is significant: specific patterns precede broad ones.
 */
function matchProviderPattern(hostname: string): ProviderPattern | undefined {
	const host = hostname.toLowerCase()
	for (const pattern of PROVIDER_PATTERNS) {
		const matches =
			typeof pattern.pattern === 'string'
				? host.includes(pattern.pattern)
				: pattern.pattern.test(host)
		if (matches) {
			return pattern
		}
	}
	return undefined
}

function inferProviderFromUrl(parsed: URL): DatabaseType | undefined {
	const hostname = parsed.hostname.toLowerCase()
	const port = parsed.port ? parseInt(parsed.port, 10) : undefined
	const database = parsed.pathname.slice(1).toLowerCase()

	if (hostname.includes('cockroach') || hostname.includes('crdb') || port === 26257) {
		return 'cockroach'
	}

	if (hostname.includes('mariadb') || hostname.includes('maria')) {
		return 'mariadb'
	}

	if (port === 3306) {
		if (database.includes('maria') || database.includes('mariadb')) {
			return 'mariadb'
		}
	}

	return undefined
}

/**
 * Connection string builder parameters
 */
export type ConnectionParams = {
	type: DatabaseType
	host?: string
	port?: number
	user?: string
	password?: string
	database?: string
	ssl?: boolean
}

/**
 * Builds a connection string from individual parameters
 */
export function buildConnectionString(params: ConnectionParams): string {
	const config = PROVIDER_CONFIGS[params.type]

	if (params.type === 'sqlite') {
		throw new Error('SQLite uses file paths, not connection strings')
	}

	if (params.type === 'duckdb') {
		throw new Error('DuckDB uses file paths, not connection strings')
	}

	if (params.type === 'libsql') {
		throw new Error('LibSQL requires a URL and auth token')
	}

	const user = normalizeConnectionField(params.user) || config.defaultUser
	const password = params.password || ''
	const host = normalizeConnectionField(params.host) || 'localhost'
	const port = params.port || config.defaultPort
	const database = normalizeConnectionField(params.database) || config.defaultDatabase

	// Build base URL
	const protocol = config.protocols[0]
	let url = `${protocol}://${encodeURIComponent(user)}`

	if (password) {
		url += `:${encodeURIComponent(password)}`
	}

	url += `@${host}:${port}/${encodeURIComponent(database)}`

	// Add SSL parameter if enabled
	if (params.ssl && config.supportsSSL) {
		url += '?sslmode=require'
	}

	return url
}

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for typo detection in connection protocols.
 */
function levenshtein(a: string, b: string): number {
	const matrix: number[][] = []

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i]
	}

	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1]
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					Math.min(
						matrix[i][j - 1] + 1, // insertion
						matrix[i - 1][j] + 1 // deletion
					)
				)
			}
		}
	}

	return matrix[b.length][a.length]
}

type ProtocolMatch = {
	type: DatabaseType
	normalizedDistance: number
	sharesPrefix: boolean
}

function findClosestProtocol(input: string): DatabaseType | undefined {
	const MIN_PROTOCOL_LENGTH = 4
	const MAX_NORMALIZED_DISTANCE = 0.4
	const PREFIX_BONUS_THRESHOLD = 0.6
	const PREFIX_LENGTH = 3

	if (input.length < MIN_PROTOCOL_LENGTH) {
		return undefined
	}

	const inputLower = input.toLowerCase()
	let bestMatch: ProtocolMatch | undefined

	for (const [dbType, config] of Object.entries(PROVIDER_CONFIGS)) {
		for (const proto of config.protocols) {
			const protoLower = proto.toLowerCase()
			const distance = levenshtein(inputLower, protoLower)
			const maxLength = Math.max(inputLower.length, protoLower.length)
			const normalizedDistance = distance / maxLength

			const sharesPrefix =
				inputLower.slice(0, PREFIX_LENGTH) === protoLower.slice(0, PREFIX_LENGTH)

			const isAcceptable = sharesPrefix
				? normalizedDistance <= PREFIX_BONUS_THRESHOLD
				: normalizedDistance <= MAX_NORMALIZED_DISTANCE

			if (!isAcceptable) {
				continue
			}

			if (!bestMatch || normalizedDistance < bestMatch.normalizedDistance) {
				bestMatch = {
					type: dbType as DatabaseType,
					normalizedDistance,
					sharesPrefix
				}
			}
		}
	}

	return bestMatch?.type
}

/**
 * Parses a connection URL to extract components
 */
export function parseConnectionUrl(url: string): Partial<ConnectionParams> | null {
	try {
		const parsed = new URL(url)
		// Remove trailing colon from protocol (e.g., "postgres:" -> "postgres")
		const protocol = parsed.protocol.replace(':', '')
		const urlProviderHint = inferProviderFromUrl(parsed)

		// Determine database type from protocol
		let type: DatabaseType | undefined

		// 1. Try exact match first
		for (const [dbType, config] of Object.entries(PROVIDER_CONFIGS)) {
			if (config.protocols.includes(protocol)) {
				type = dbType as DatabaseType
				break
			}
		}

		if (urlProviderHint === 'cockroach' && (type === 'postgres' || type === 'cockroach')) {
			type = 'cockroach'
		}

		if (urlProviderHint === 'mariadb' && (type === 'mysql' || type === 'mariadb')) {
			type = 'mariadb'
		}

		const matchedProvider = matchProviderPattern(parsed.hostname)
		// A pattern `type` overrides the protocol-derived engine only where the
		// provider forces a dialect (e.g. cockroach) or is single-engine. Dual-engine
		// providers leave `type` undefined so the protocol/port keeps deciding.
		if (matchedProvider?.type) {
			type = matchedProvider.type
		}

		// 2. If no exact match, try fuzzy matching (typo detection)
		if (!type) {
			type = findClosestProtocol(protocol)
		}

		if (!type) {
			return null
		}

		const params: Partial<ConnectionParams> = {
			type,
			host: parsed.hostname,
			port: parsed.port ? parseInt(parsed.port) : undefined,
			user: parsed.username || undefined,
			password: parsed.password || undefined,
			database: parsed.pathname.slice(1) || undefined // Remove leading slash
		}

		// Check for SSL in query params. An explicit `sslmode`/`ssl` param always
		// wins; otherwise a managed provider with `requiresSsl` defaults SSL on.
		const searchParams = new URLSearchParams(parsed.search)
		const hasExplicitSsl = searchParams.has('sslmode') || searchParams.has('ssl')
		if (hasExplicitSsl) {
			params.ssl = true
		} else if (matchedProvider?.requiresSsl) {
			params.ssl = true
		}

		return params
	} catch {
		return null
	}
}

/**
 * Detects provider from hostname and returns a friendly name
 */
export function detectProviderName(url: string): string {
	try {
		const parsed = new URL(url)
		const hostname = parsed.hostname.toLowerCase()
		const urlProviderHint = inferProviderFromUrl(parsed)

		// A named host pattern (e.g. "CockroachDB Cloud") is more specific than the
		// generic engine hint, so it wins when both apply.
		const matched = matchProviderPattern(hostname)
		if (matched) {
			return matched.displayName
		}

		if (urlProviderHint === 'cockroach') {
			return 'CockroachDB'
		}

		if (urlProviderHint === 'mariadb') {
			return 'MariaDB DB'
		}

		// Fallback: use first part of hostname
		const parts = hostname.split('.')
		const name = parts[0] || 'Database'
		return name.charAt(0).toUpperCase() + name.slice(1) + ' DB'
	} catch {
		return 'New Connection'
	}
}

/**
 * Checks if a string is a valid connection URL
 */
export function isValidConnectionUrl(text: string): boolean {
	const trimmed = text.trim()
	const allProtocols = Object.values(PROVIDER_CONFIGS).flatMap((config) => config.protocols)

	const pattern = new RegExp(`^(${allProtocols.join('|')})://`, 'i')
	return pattern.test(trimmed)
}

/**
 * Returns true when the URL's host is a Fly.io **public** endpoint
 * (fly.dev or flympg hostnames reachable only via `fly proxy`).
 *
 * Returns false for Fly.io **private** hosts (.internal / .flycast)
 * that are routable over a Fly WireGuard tunnel without proxying.
 */
export function isFlyPublicHost(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase()
		return /fly\.dev|flympg/.test(host)
	} catch {
		return false
	}
}

export function hasPostgresPoolerMode(url: string): boolean {
	try {
		const parsed = new URL(url)
		const params = parsed.searchParams
		const host = parsed.hostname.toLowerCase()
		const port = parsed.port

		return (
			params.get('simple_query') === 'true' ||
			params.get('pgbouncer') === 'true' ||
			params.get('pooler') === 'true' ||
			params.get('pooler') === 'transaction' ||
			params.get('prepared_statements') === 'false' ||
			params.get('statement_cache_size') === '0' ||
			host.includes('pooler') ||
			host.includes('pgbouncer') ||
			port === '6432' ||
			port === '6543'
		)
	} catch {
		return false
	}
}

export function setPostgresPoolerMode(url: string, enabled: boolean): string {
	try {
		const parsed = new URL(url)
		if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
			return url
		}

		if (enabled) {
			parsed.searchParams.set('simple_query', 'true')
		} else {
			parsed.searchParams.delete('simple_query')
		}

		return parsed.toString()
	} catch {
		return url
	}
}

/**
 * Gets connection field defaults for a database type
 */
export function getConnectionDefaults(type: DatabaseType): Partial<ConnectionParams> {
	const config = PROVIDER_CONFIGS[type]

	return {
		type,
		host: 'localhost',
		port: config.defaultPort > 0 ? config.defaultPort : undefined,
		user: config.defaultUser || undefined,
		database: config.defaultDatabase || undefined,
		ssl: false
	}
}

/**
 * Strips matching outer quotes (single or double) from a string.
 */
function stripQuotes(s: string): string {
	const trimmed = s.trim()
	if (
		(trimmed.startsWith("'") && trimmed.endsWith("'")) ||
		(trimmed.startsWith('"') && trimmed.endsWith('"'))
	) {
		return trimmed.slice(1, -1)
	}
	return trimmed
}

function stripTrailingShellComment(s: string): string {
	let quote: '"' | "'" | null = null

	for (let i = 0; i < s.length; i++) {
		const char = s[i]

		if (quote) {
			if (char === quote) {
				quote = null
			}
			continue
		}

		if (char === '"' || char === "'") {
			quote = char
			continue
		}

		if (char === '#' && (i === 0 || /\s/.test(s[i - 1]))) {
			return s.slice(0, i).trimEnd()
		}
	}

	return s
}

function normalizeConnectionField(value?: string): string {
	return stripTrailingShellComment(value?.trim() || '')
}

type PsqlFlagOptions = {
	host?: string
	port?: string
	user?: string
	database?: string
	password?: string
	sslmode?: string
}

function tokenizeShellLike(input: string): string[] | null {
	const tokens: string[] = []
	let token = ''
	let quote: '"' | "'" | null = null

	for (let i = 0; i < input.length; i++) {
		const char = input[i]

		if (quote) {
			if (char === quote) {
				quote = null
			} else {
				token += char
			}
			continue
		}

		if (char === '"' || char === "'") {
			quote = char
			continue
		}

		if (/\s/.test(char)) {
			if (token) {
				tokens.push(token)
				token = ''
			}
			continue
		}

		token += char
	}

	if (quote) {
		return null
	}

	if (token) {
		tokens.push(token)
	}

	return tokens
}

function parseAssignment(token: string): [string, string] | null {
	const match = token.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i)
	if (!match) {
		return null
	}
	return [match[1].toUpperCase(), stripQuotes(match[2])]
}

function consumeFlagValue(tokens: string[], index: number, flag: string): string | null {
	const token = tokens[index]
	const eqPrefix = `${flag}=`
	if (token.startsWith(eqPrefix)) {
		return token.slice(eqPrefix.length)
	}
	return tokens[index + 1] || null
}

function postgresUrlFromPsqlFlags(input: string): string | null {
	const tokens = tokenizeShellLike(input)
	if (!tokens?.length) {
		return null
	}

	const options: PsqlFlagOptions = {}
	let psqlIndex = -1

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]

		if (token.toLowerCase() === 'psql') {
			psqlIndex = i
			break
		}

		const assignment = parseAssignment(token)
		if (!assignment) {
			return null
		}

		const [key, value] = assignment
		if (key === 'PGPASSWORD') {
			options.password = value
		}
	}

	if (psqlIndex === -1) {
		return null
	}

	for (let i = psqlIndex + 1; i < tokens.length; i++) {
		const token = tokens[i]

		if (isValidConnectionUrl(token)) {
			return token
		}

		const readValue = (flag: string) => consumeFlagValue(tokens, i, flag)

		switch (token) {
			case '-h':
			case '--host':
				options.host = readValue(token) || undefined
				i += 1
				break
			case '-p':
			case '--port':
				options.port = readValue(token) || undefined
				i += 1
				break
			case '-U':
			case '--username':
				options.user = readValue(token) || undefined
				i += 1
				break
			case '-d':
			case '--dbname':
				options.database = readValue(token) || undefined
				i += 1
				break
			default:
				if (token.startsWith('--host=')) {
					options.host = readValue('--host') || undefined
				} else if (token.startsWith('--port=')) {
					options.port = readValue('--port') || undefined
				} else if (token.startsWith('--username=')) {
					options.user = readValue('--username') || undefined
				} else if (token.startsWith('--dbname=')) {
					options.database = readValue('--dbname') || undefined
				} else if (token.includes('=')) {
					const [key, value] = token.split(/=(.*)/s, 2)
					if (key === 'sslmode') {
						options.sslmode = value
					}
				}
		}
	}

	if (!options.host || !options.user) {
		return null
	}

	const database = options.database || PROVIDER_CONFIGS.postgres.defaultDatabase
	const port = options.port || PROVIDER_CONFIGS.postgres.defaultPort.toString()
	let url = `postgresql://${encodeURIComponent(options.user)}`

	if (options.password) {
		url += `:${encodeURIComponent(options.password)}`
	}

	url += `@${options.host}:${port}/${encodeURIComponent(database)}`

	if (options.sslmode) {
		url += `?sslmode=${encodeURIComponent(options.sslmode)}`
	}

	return url
}

/**
 * Connection URL Sanitizer
 *
 * Normalizes wrapper formats around an already valid connection URL.
 * This is NOT a universal connection string parser.
 *
 * SUPPORTED INPUT SHAPES:
 * - Plain URL: postgresql://user:pass@host/db, libsql://db.turso.io
 * - URL wrapped in quotes: "postgresql://...", 'libsql://...'
 * - psql wrapper: psql "postgresql://...", psql 'postgresql://...'
 * - psql flags: PGPASSWORD=pw psql -h host -p 5432 -U user -d db sslmode=require
 * - Single env var assignment: DATABASE_URL=postgresql://..., DB_URL="libsql://..."
 * - Combined: DATABASE_URL="psql 'postgresql://...'"
 *
 * EXPLICITLY NOT SUPPORTED:
 * - libpq key-value strings (host=localhost user=me dbname=test)
 * - Multiple assignments in one line
 * - Shell expansions ($VAR, $(cmd))
 * - Multiline values
 * - Escaped or nested quotes
 * - URLs embedded in freeform text
 * - Non-URL based connection formats
 *
 * DIALECT RULE:
 * The sanitizer is dialect-agnostic. It only strips wrappers and never
 * validates or interprets the scheme. Dialect handling belongs in a
 * separate parser layer.
 */
export function sanitizeConnectionUrl(input: string): string {
	let value = input.trim()

	// Bail early if empty or multiline (not supported)
	if (!value || value.includes('\n')) {
		return value
	}

	// Step 1: Strip single environment variable assignment prefix
	// Matches: VAR_NAME=value, VAR_NAME="value", VAR_NAME='value'
	// Does NOT match: multiple assignments or shell expansions
	const envVarPattern = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/i
	const envVarMatch = value.match(envVarPattern)
	if (envVarMatch) {
		const assignedValue = envVarMatch[2]
		// Check for shell expansion or multiple assignments (not supported)
		if (
			assignedValue.startsWith('$') ||
			(assignedValue.includes(' ') && assignedValue.includes('='))
		) {
			const psqlUrl = postgresUrlFromPsqlFlags(value)
			if (psqlUrl) {
				return psqlUrl
			}
			return value // Return as-is, let the dialect parser handle it
		}
		value = assignedValue
	}

	value = stripTrailingShellComment(value).trim()

	// Step 2: Strip outer quotes (single or double)
	value = stripQuotes(value)

	// Step 3: Strip psql command wrapper
	// Matches: psql "url", psql 'url', psql url
	const psqlPattern = /^psql\s+(.+)$/i
	const psqlMatch = value.match(psqlPattern)
	if (psqlMatch) {
		value = stripQuotes(psqlMatch[1].trim())
	}

	// Step 4: Strip any remaining outer quotes
	value = stripTrailingShellComment(stripQuotes(value)).trim()

	if (!isValidConnectionUrl(value)) {
		const psqlUrl = postgresUrlFromPsqlFlags(input)
		if (psqlUrl) {
			return psqlUrl
		}
	}

	return value
}

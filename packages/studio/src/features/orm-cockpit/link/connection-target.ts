/**
 * Decide whether a linked project's intended database is actually the one the
 * cockpit is comparing against. The cockpit diffs a project's *code* schema
 * against a *live* connection; if they're different databases the diff is
 * meaningless (every table reads as an add/drop). This module extracts a coarse
 * {@link DbTarget} — host / port / database, or a file path — from both sides
 * and compares them.
 *
 * Resolution is best-effort: a project's `url` is often `env.DATABASE_URL`, so
 * we read the project's `.env*` files. When we can't resolve either side the
 * verdict is `unknown` and the caller should stay silent rather than warn.
 */

import type { DetectedOrm, ProjectReader } from '@studio/features/orm-cockpit/link/detect-orm'

export type DbEngine = 'postgres' | 'mysql' | 'sqlite' | 'libsql' | 'unknown'

export type DbTarget = {
	engine: DbEngine
	host?: string
	port?: number
	database?: string
	/** For file-backed engines (sqlite/duckdb/local libsql). */
	file?: string
}

export type MatchVerdict = 'match' | 'mismatch' | 'unknown'

/** A coarse connection shape — the fields the frontend Connection model exposes. */
export type ConnectionShape = {
	type: string
	host?: string
	port?: number
	database?: string
	url?: string
}

/** `.env` files read (in priority order) to resolve an `env.X` database url. */
const ENV_FILES = [
	'.env.local',
	'.env.development.local',
	'.env.development',
	'.env',
	'.env.production.local',
	'.env.production',
]

/** Parse a postgres/mysql/libsql/file URL into a {@link DbTarget}. */
export function targetFromUrl(raw: string): DbTarget | null {
	const cleaned = raw.trim().replace(/^["'`]/, '').replace(/["'`]$/, '')
	let url: URL
	try {
		url = new URL(cleaned)
	} catch {
		return null
	}

	const scheme = url.protocol.replace(/:$/, '').toLowerCase()
	// `ecto://` (Elixir/Ecto's DATABASE_URL scheme) resolves to postgres: Ecto's MyXQL
	// adapter writes the same scheme for MySQL, but returning null here silently disables
	// the schema-diff mismatch warning, which is worse than a coarse engine default.
	if (scheme.startsWith('postgres') || scheme === 'cockroachdb' || scheme === 'ecto') {
		return networkTarget('postgres', url)
	}
	if (scheme === 'mysql' || scheme === 'mariadb') {
		return networkTarget('mysql', url)
	}
	if (scheme === 'libsql' || scheme === 'http' || scheme === 'https' || scheme === 'wss') {
		return { engine: 'libsql', host: url.hostname.toLowerCase() || undefined }
	}
	if (scheme === 'file' || scheme === 'sqlite') {
		return { engine: 'sqlite', file: normalizeFile(url.pathname) }
	}
	return null
}

function networkTarget(engine: DbEngine, url: URL): DbTarget {
	const database = url.pathname.replace(/^\//, '').split('/')[0]
	return {
		engine,
		host: url.hostname.toLowerCase() || undefined,
		port: url.port ? Number(url.port) : undefined,
		database: database || undefined,
	}
}

/** Build a {@link DbTarget} from the frontend connection model. */
export function targetFromConnection(conn: ConnectionShape): DbTarget | null {
	const type = conn.type.toLowerCase()
	if (type === 'sqlite' || type === 'duckdb') {
		return conn.url ? { engine: 'sqlite', file: normalizeFile(conn.url) } : null
	}
	if (type === 'libsql') {
		const url = conn.url ?? ''
		if (/^(libsql|https?|wss?):\/\//i.test(url)) {
			return targetFromUrl(url) ?? { engine: 'libsql' }
		}
		return url ? { engine: 'sqlite', file: normalizeFile(url) } : null
	}
	const engine: DbEngine = type === 'mysql' || type === 'mariadb' ? 'mysql' : 'postgres'
	return {
		engine,
		host: conn.host?.toLowerCase() || undefined,
		port: conn.port,
		database: conn.database || undefined,
	}
}

/**
 * Resolve the database a linked project points at, from its config's `url` —
 * either a literal URL or an `env.X` reference resolved against the project's
 * `.env*` files. Returns null when it can't be determined.
 */
export async function resolveProjectTarget(
	rootDir: string,
	configText: string | null,
	_orm: DetectedOrm,
	reader: ProjectReader
): Promise<DbTarget | null> {
	const ref = extractUrlReference(configText)
	if (!ref) {
		return null
	}
	if (ref.kind === 'literal') {
		return targetFromUrl(ref.value)
	}
	const value = await readEnvVar(rootDir, ref.value, reader)
	return value ? targetFromUrl(value) : null
}

type UrlReference = { kind: 'literal'; value: string } | { kind: 'env'; value: string }

/**
 * Pull the database url out of a drizzle.config / prisma schema text. Matches a
 * literal `url: "postgres://…"` first, then an env reference in any of the
 * common forms: `env.X`, `process.env.X`, `env("X")`, `env('X')`, `env["X"]`.
 */
export function extractUrlReference(configText: string | null): UrlReference | null {
	if (configText === null) {
		return null
	}

	const literal = configText.match(/\burl\s*[:=]\s*["'`]([^"'`]+:\/\/[^"'`]+)["'`]/)
	if (literal) {
		return { kind: 'literal', value: literal[1] }
	}

	const envRef = configText.match(
		/\burl\s*[:=]\s*[^,\n}]*?(?:env\(\s*["'`](\w+)["'`]\s*\)|(?:process\.)?env\.(\w+)|(?:process\.)?env\[\s*["'`](\w+)["'`]\s*\])/
	)
	if (envRef) {
		return { kind: 'env', value: envRef[1] ?? envRef[2] ?? envRef[3] }
	}
	return null
}

async function readEnvVar(
	rootDir: string,
	key: string,
	reader: ProjectReader
): Promise<string | null> {
	for (const file of ENV_FILES) {
		const text = await reader.readFile(joinPath(rootDir, file))
		if (text === null) {
			continue
		}
		const value = parseEnvVar(text, key)
		if (value) {
			return value
		}
	}
	return null
}

/** Read a single `KEY=value` out of a `.env` file's text. */
export function parseEnvVar(envText: string, key: string): string | null {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = envText.match(new RegExp(`^\\s*(?:export\\s+)?${escaped}\\s*=\\s*(.+?)\\s*$`, 'm'))
	if (!match) {
		return null
	}
	let value = match[1].trim()
	if (!/^["'`]/.test(value)) {
		value = value.replace(/\s+#.*$/, '').trim()
	}
	value = value.replace(/^["'`]/, '').replace(/["'`]$/, '')
	return value || null
}

/**
 * Compare a project's intended target with the connection being diffed against.
 * Conservative: only returns `mismatch` on a strong signal (different database
 * name or different file), so env-indirection and pooler/direct host quirks
 * don't produce false warnings.
 */
export function compareTargets(
	project: DbTarget | null,
	connection: DbTarget | null
): MatchVerdict {
	if (!project || !connection) {
		return 'unknown'
	}
	if (project.engine === 'unknown' || connection.engine === 'unknown') {
		return 'unknown'
	}

	const projectFileLike = project.engine === 'sqlite' || project.engine === 'libsql'
	const connectionFileLike = connection.engine === 'sqlite' || connection.engine === 'libsql'
	if (projectFileLike || connectionFileLike) {
		if (project.file && connection.file) {
			return sameFile(project.file, connection.file) ? 'match' : 'mismatch'
		}
		return 'unknown'
	}

	if (project.engine !== connection.engine) {
		return 'mismatch'
	}
	if (!project.database || !connection.database) {
		return 'unknown'
	}
	if (project.database.toLowerCase() !== connection.database.toLowerCase()) {
		return 'mismatch'
	}
	// Same database name: only call it a match when hosts agree; differing hosts
	// (pooler vs direct, etc.) are too ambiguous to flag, so stay silent.
	if (project.host && connection.host) {
		return sameHost(project.host, connection.host) ? 'match' : 'unknown'
	}
	return 'match'
}

/** A short human label for a target, used in the mismatch warning copy. */
export function describeTarget(target: DbTarget): string {
	if (target.engine === 'sqlite' || target.engine === 'libsql') {
		return target.file ? basename(target.file) : 'a local database'
	}
	const where = target.host ? ` on ${target.host}` : ''
	if (target.database) {
		return `“${target.database}”${where}`
	}
	return target.host ?? 'an unknown database'
}

function sameHost(a: string, b: string): boolean {
	return normalizeHost(a) === normalizeHost(b)
}

function normalizeHost(host: string): string {
	const lower = host.toLowerCase()
	if (lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') {
		return 'localhost'
	}
	return lower
}

function sameFile(a: string, b: string): boolean {
	return normalizeFile(a) === normalizeFile(b)
}

function normalizeFile(path: string): string {
	return path.replace(/^\/+/, '/').replace(/\/+$/, '')
}

function basename(path: string): string {
	const i = path.lastIndexOf('/')
	return i >= 0 ? path.slice(i + 1) : path
}

function joinPath(base: string, rel: string): string {
	return `${base.replace(/\/+$/, '')}/${rel.replace(/^\/+/, '')}`
}

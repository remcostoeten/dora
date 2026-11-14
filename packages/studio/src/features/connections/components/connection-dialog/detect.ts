import type { DatabaseType } from '../../types'
import {
	PROVIDER_CONFIGS,
	hasPostgresPoolerMode,
	isFlyPublicHost,
	matchProviderPattern,
	parseConnectionUrl,
	sanitizeConnectionUrl
} from '../../utils/providers'
import { classifyDroppedPaths, databaseTypeForExtension } from '../../utils/data-files'
import type { IntegrationKey } from './model'

export type UrlDetection = {
	kind: 'url'
	engine: DatabaseType
	provider: string | null
	account: IntegrationKey | null
	host: string
	port: string
	user: string
	password: string
	database: string
	ssl: boolean
	sslWhy: string
	pooler: boolean
	token: string
	typo: { from: string; to: string } | null
	fly: boolean
	raw: string
}

export type Detection =
	| UrlDetection
	| { kind: 'partial'; engine: DatabaseType; raw: string }
	| { kind: 'file'; engine: 'sqlite' | 'duckdb'; path: string }
	| { kind: 'datafile'; path: string }
	| { kind: 'unknown'; scheme: string }
	| { kind: 'badpath'; path: string }

const PATH_LIKE = /^(~|\/|\.{1,2}\/|[a-z]:\\)/i
const FILE_EXTENSION =
	/\.(sqlite[23]?|db3?|s3db|sl3|duckdb|csv|tsv|txt|parquet|pq|json|ndjson|jsonl)$/i
const SCHEME = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i
const SSL_OFF = new Set(['disable', 'false', '0'])

const ACCOUNT_HOSTS: readonly { host: RegExp; account: IntegrationKey }[] = [
	{ host: /supabase\.(co|com)/, account: 'supabase' },
	{ host: /neon\.tech/, account: 'neon' },
	{ host: /sql\.xata\.sh/, account: 'xata' },
	{ host: /vercel-storage\.com/, account: 'vercel' },
	{ host: /psdb\.cloud|planetscale/, account: 'planetscale' },
	{ host: /turso\.(io|tech)/, account: 'turso' }
]

function decode(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function detectPath(path: string): Detection {
	const { dataFiles, databaseFiles } = classifyDroppedPaths([path])
	if (dataFiles.length > 0) return { kind: 'datafile', path }
	if (databaseFiles.length > 0) {
		const engine = databaseTypeForExtension(path) === 'duckdb' ? 'duckdb' : 'sqlite'
		return { kind: 'file', engine, path }
	}
	return { kind: 'badpath', path }
}

function sslFrom(
	params: URLSearchParams,
	requiredBy: string | null
): { ssl: boolean; sslWhy: string } {
	const key = ['sslmode', 'ssl', 'sslaccept'].find((name) => params.has(name))
	if (key) {
		const value = params.get(key) ?? ''
		return { ssl: !SSL_OFF.has(value.toLowerCase()), sslWhy: `from ${key}=${value}` }
	}
	if (requiredBy) return { ssl: true, sslWhy: `required by ${requiredBy}` }
	return { ssl: false, sslWhy: '' }
}

function detectUrl(value: string, scheme: string): Detection {
	const parsed = parseConnectionUrl(value)
	if (!parsed?.type) {
		const exact = Object.entries(PROVIDER_CONFIGS).find(([, config]) =>
			config.protocols.includes(scheme)
		)
		if (exact) return { kind: 'partial', engine: exact[0] as DatabaseType, raw: value }
		return { kind: 'unknown', scheme }
	}

	if (parsed.type === 'sqlite' || parsed.type === 'duckdb') {
		return { kind: 'file', engine: parsed.type, path: value.replace(SCHEME, '$2') }
	}

	let url: URL
	try {
		url = new URL(value)
	} catch {
		return { kind: 'partial', engine: parsed.type, raw: value }
	}
	if (!url.hostname) return { kind: 'partial', engine: parsed.type, raw: value }

	const engine = parsed.type
	const matched = matchProviderPattern(url.hostname)
	const provider = matched ? matched.displayName.replace(/ DB$/, '') : null
	const host = url.hostname.toLowerCase()
	const account = ACCOUNT_HOSTS.find((entry) => entry.host.test(host))?.account ?? null
	const { ssl, sslWhy } = sslFrom(url.searchParams, matched?.requiresSsl ? provider : null)
	const canonical = PROVIDER_CONFIGS[engine].protocols[0]
	const typo = PROVIDER_CONFIGS[engine].protocols.includes(scheme.toLowerCase())
		? null
		: { from: scheme, to: canonical }

	return {
		kind: 'url',
		engine,
		provider,
		account,
		host: url.hostname,
		port: url.port,
		user: decode(url.username),
		password: decode(url.password),
		database: decode(url.pathname.slice(1)),
		ssl,
		sslWhy,
		pooler: engine === 'postgres' && hasPostgresPoolerMode(value),
		token: url.searchParams.get('authToken') ?? '',
		typo,
		fly: isFlyPublicHost(value),
		raw: value
	}
}

/**
 * @name detect
 * @description Reads a pasted or typed string and works out what it is: a
 * connection URL (with engine, provider and parsed parts), a path to a
 * database or data file, a URL Dora cannot read, or nothing at all.
 *
 * @example
 * const found = detect('postgres://app:secret@ep-1.neon.tech/shop')
 * if (found?.kind === 'url') console.log(found.engine, found.provider)
 */
export function detect(raw: string): Detection | null {
	const value = sanitizeConnectionUrl(raw)
	if (!value) return null

	const scheme = value.match(SCHEME)
	if (scheme) return detectUrl(value, scheme[1].toLowerCase())

	if (PATH_LIKE.test(value) || FILE_EXTENSION.test(value)) return detectPath(value)
	return null
}

export function isActionable(
	detection: Detection | null
): detection is Exclude<Detection, { kind: 'unknown' | 'badpath' }> {
	return detection !== null && detection.kind !== 'unknown' && detection.kind !== 'badpath'
}

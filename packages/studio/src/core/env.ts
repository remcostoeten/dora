/**
 * Framework-agnostic env shim.
 *
 * The studio source is consumed as raw source by two bundlers:
 *   - Vite (apps/desktop) exposes config via `import.meta.env`
 *   - Next.js (apps/marketing) exposes config via `process.env` (NEXT_PUBLIC_*)
 *
 * Reading `import.meta.env` directly breaks under Next, so all env access goes
 * through this module. Under Next, `import.meta.env` is undefined and we fall
 * back to `process.env` (with an optional `NEXT_PUBLIC_` prefix).
 */

function readViteEnv(): Record<string, unknown> {
	try {
		// `import.meta.env` is a real object under Vite, undefined elsewhere.
		const meta = import.meta as unknown as { env?: Record<string, unknown> }
		return meta?.env ?? {}
	} catch {
		return {}
	}
}

function readNodeEnv(): Record<string, string | undefined> {
	try {
		return typeof process !== 'undefined' && process.env ? process.env : {}
	} catch {
		return {}
	}
}

const VITE = readViteEnv()
const NODE = readNodeEnv()

/** Read a (typically `VITE_`-prefixed) env var from whichever host we run in. */
export function getEnv(key: string): string | undefined {
	const fromVite = VITE[key]
	if (fromVite !== undefined && fromVite !== null) {
		return typeof fromVite === 'string' ? fromVite : String(fromVite)
	}
	return NODE[key] ?? NODE[`NEXT_PUBLIC_${key}`]
}

function asBool(value: unknown, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value
	if (value == null || value === '') return fallback
	return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export const ENV_MODE: string =
	(VITE.MODE as string | undefined) ?? NODE.NODE_ENV ?? 'production'

export const ENV_PROD: boolean = asBool(VITE.PROD, NODE.NODE_ENV === 'production')

export const ENV_DEV: boolean = asBool(VITE.DEV, NODE.NODE_ENV === 'development')

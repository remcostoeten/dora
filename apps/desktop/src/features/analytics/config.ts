import type { AnalyticsConfig, AnalyticsConfigInput } from './types'

const DEFAULT_PROJECT_ID = 'dora-desktop'

/**
 * Creates a normalized analytics config from optional environment-specific input.
 *
 * Keep this file framework-agnostic: pass Vite `import.meta.env` values or Next.js
 * `process.env.NEXT_PUBLIC_*` values from a thin app-specific config file.
 */
export function createAnalyticsConfig(input: AnalyticsConfigInput = {}): AnalyticsConfig {
	const environment = input.environment ?? 'production'
	const isProduction = environment === 'production'
	const enabled = input.enabled ?? isProduction
	const debug = input.debug ?? !isProduction

	return {
		enabled,
		debug,
		environment,
		remcostoeten: {
			enabled: input.remcostoeten?.enabled ?? true,
			projectId: input.remcostoeten?.projectId ?? DEFAULT_PROJECT_ID,
			ingestUrl: input.remcostoeten?.ingestUrl,
			debug: input.remcostoeten?.debug ?? debug
		},
		vercel: {
			enabled: input.vercel?.enabled ?? isProduction,
			trackCustomEvents: input.vercel?.trackCustomEvents ?? false
		},
		console: {
			enabled: input.console?.enabled ?? debug
		},
		privacy: {
			respectDoNotTrack: input.privacy?.respectDoNotTrack ?? true,
			stripSensitiveMetadata: input.privacy?.stripSensitiveMetadata ?? true
		}
	}
}

/** Deep-merges a partial config over the normalized defaults. */
export function resolveAnalyticsConfig(input?: AnalyticsConfigInput): AnalyticsConfig {
	return createAnalyticsConfig(input)
}

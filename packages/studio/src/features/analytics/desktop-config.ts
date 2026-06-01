import { ENV_DEV, ENV_MODE, ENV_PROD, getEnv } from '@studio/core/env'
import { createAnalyticsConfig } from './config'

function envFlag(value: string | boolean | undefined, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value
	if (value == null || value === '') return fallback
	return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

/**
 * Analytics configuration for the Dora desktop/Vite app.
 *
 * Reuse `createAnalyticsConfig` directly in Next.js and pass
 * `process.env.NEXT_PUBLIC_*` values from a client boundary instead.
 */
export const desktopAnalyticsConfig = createAnalyticsConfig({
	environment: ENV_MODE,
	enabled: envFlag(getEnv('VITE_ANALYTICS_ENABLED'), ENV_PROD),
	debug: envFlag(getEnv('VITE_ANALYTICS_DEBUG'), ENV_DEV),
	remcostoeten: {
		enabled: envFlag(getEnv('VITE_REMCO_ANALYTICS_ENABLED'), true),
		projectId: getEnv('VITE_ANALYTICS_PROJECT_ID') ?? 'dora-desktop',
		ingestUrl: getEnv('VITE_ANALYTICS_INGEST_URL') ?? 'https://ingestion.remcostoeten.nl'
	},
	vercel: {
		enabled: envFlag(getEnv('VITE_VERCEL_ANALYTICS_ENABLED'), ENV_PROD),
		trackCustomEvents: envFlag(getEnv('VITE_VERCEL_ANALYTICS_EVENTS'), false)
	}
})

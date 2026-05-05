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
	environment: import.meta.env.MODE,
	enabled: envFlag(import.meta.env.VITE_ANALYTICS_ENABLED, import.meta.env.PROD),
	debug: envFlag(import.meta.env.VITE_ANALYTICS_DEBUG, import.meta.env.DEV),
	remcostoeten: {
		enabled: envFlag(import.meta.env.VITE_REMCO_ANALYTICS_ENABLED, true),
		projectId: import.meta.env.VITE_ANALYTICS_PROJECT_ID ?? 'dora-desktop',
		ingestUrl: import.meta.env.VITE_ANALYTICS_INGEST_URL ?? 'https://ingestion.remcostoeten.nl'
	},
	vercel: {
		enabled: envFlag(import.meta.env.VITE_VERCEL_ANALYTICS_ENABLED, import.meta.env.PROD),
		trackCustomEvents: envFlag(import.meta.env.VITE_VERCEL_ANALYTICS_EVENTS, false)
	}
})

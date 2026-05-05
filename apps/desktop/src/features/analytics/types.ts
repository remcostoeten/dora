import type { AnalyticsOptions, TrackMeta } from '@remcostoeten/analytics'

/** Metadata accepted by the first-party analytics SDK. */
export type AnalyticsMeta = TrackMeta

/** Environment name used to derive safe defaults for analytics. */
export type AnalyticsEnvironment = 'development' | 'production' | 'test' | string

/** Configuration for the first-party @remcostoeten analytics provider. */
export type RemcoAnalyticsProviderConfig = AnalyticsOptions & {
	/** Enables the @remcostoeten provider when global analytics are also enabled. */
	enabled: boolean
}

/** Configuration for the Vercel Analytics provider. */
export type VercelAnalyticsProviderConfig = {
	/** Enables Vercel Analytics when global analytics are also enabled. */
	enabled: boolean
	/**
	 * Sends custom events through Vercel's `track` API.
	 * Page views are still handled by Vercel's React component to avoid duplicates.
	 */
	trackCustomEvents: boolean
}

/** Privacy and safety defaults applied before an event reaches any provider. */
export type AnalyticsPrivacyConfig = {
	/** Honors browser-level Do Not Track signals. */
	respectDoNotTrack: boolean
	/** Removes common sensitive keys such as passwords, tokens, connection strings and raw SQL. */
	stripSensitiveMetadata: boolean
}

/** Optional console provider used for local debugging without shipping data to ingestion. */
export type ConsoleAnalyticsProviderConfig = {
	/** Logs analytics calls in development/debug mode. */
	enabled: boolean
}

/** Runtime analytics config shared by React, Vite and Next.js applications. */
export type AnalyticsConfig = {
	/** Global kill switch for all analytics providers. */
	enabled: boolean
	/** Enables verbose provider logging where supported. */
	debug: boolean
	/** Current runtime environment. */
	environment: AnalyticsEnvironment
	/** First-party analytics provider config. */
	remcostoeten: RemcoAnalyticsProviderConfig
	/** Vercel Analytics provider config. */
	vercel: VercelAnalyticsProviderConfig
	/** Local console provider config. */
	console: ConsoleAnalyticsProviderConfig
	/** Privacy controls applied before events are sent. */
	privacy: AnalyticsPrivacyConfig
}

/** Partial config accepted by consumers; deep-merged with safe defaults. */
export type AnalyticsConfigInput = Partial<
	Omit<AnalyticsConfig, 'remcostoeten' | 'vercel' | 'console' | 'privacy'>
> & {
	remcostoeten?: Partial<RemcoAnalyticsProviderConfig>
	vercel?: Partial<VercelAnalyticsProviderConfig>
	console?: Partial<ConsoleAnalyticsProviderConfig>
	privacy?: Partial<AnalyticsPrivacyConfig>
}

/** Props for the reusable React analytics provider. */
export type AnalyticsProviderProps = {
	/** Optional app content. Omit this when you only want to mount tracking clients. */
	children?: React.ReactNode
	/** Runtime config. Works in Vite, React Router and Next.js client components. */
	config?: AnalyticsConfigInput
}

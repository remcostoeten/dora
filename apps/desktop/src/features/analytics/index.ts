export { createAnalyticsConfig, resolveAnalyticsConfig } from './config'
export {
	captureError,
	getAnalyticsConfig,
	hasAnalyticsConsent,
	identify,
	isAnalyticsOptedOut,
	optInAnalytics,
	optOutAnalytics,
	page,
	setAnalyticsConfig,
	track
} from './client'
export { AnalyticsProvider } from './provider'
export { useCaptureError, useIdentify, usePageView, useTrack } from './hooks'
export type {
	AnalyticsConfig,
	AnalyticsConfigInput,
	AnalyticsEnvironment,
	AnalyticsMeta,
	AnalyticsPrivacyConfig,
	AnalyticsProviderProps,
	ConsoleAnalyticsProviderConfig,
	RemcoAnalyticsProviderConfig,
	VercelAnalyticsProviderConfig
} from './types'

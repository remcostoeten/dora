'use client'

import {
	checkDoNotTrack,
	identifyUser as remcoIdentifyUser,
	isOptedOut as remcoIsOptedOut,
	optIn as remcoOptIn,
	optOut as remcoOptOut,
	trackError as remcoTrackError,
	trackEvent as remcoTrackEvent,
	trackPageView as remcoTrackPageView
} from '@remcostoeten/analytics'
import { track as vercelTrack } from '@vercel/analytics'
import { createAnalyticsConfig } from './config'
import type { AnalyticsConfig, AnalyticsConfigInput, AnalyticsMeta } from './types'

let currentConfig: AnalyticsConfig = createAnalyticsConfig({ enabled: false })

const SENSITIVE_KEY_PATTERN =
	/(password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|connection[_-]?string|database[_-]?url|dsn|raw[_-]?sql|sql|query)/i

/** Returns the currently active analytics config. */
export function getAnalyticsConfig(): AnalyticsConfig {
	return currentConfig
}

/**
 * Updates the singleton analytics config used by `track`, `page`, `identify` and hooks.
 * This keeps product code framework-agnostic while providers can be mounted by React/Next.
 */
export function setAnalyticsConfig(input: AnalyticsConfigInput = {}): AnalyticsConfig {
	currentConfig = createAnalyticsConfig(input)
	return currentConfig
}

/** Returns true when global settings and privacy signals allow analytics to run. */
export function hasAnalyticsConsent(config: AnalyticsConfig = currentConfig): boolean {
	if (!config.enabled) return false
	if (config.privacy.respectDoNotTrack && checkDoNotTrack()) return false
	return !remcoIsOptedOut()
}

/** Opts the current browser/device out of first-party analytics. */
export function optOutAnalytics(): void {
	remcoOptOut()
}

/** Re-enables first-party analytics after a previous opt-out. */
export function optInAnalytics(): void {
	remcoOptIn()
}

/** Returns whether the current browser/device has opted out. */
export function isAnalyticsOptedOut(): boolean {
	return remcoIsOptedOut()
}

/** Tracks a custom product event through the configured providers. */
export function track(name: string, data?: Record<string, unknown>): void {
	const config = currentConfig
	if (!hasAnalyticsConsent(config)) return

	const meta = toAnalyticsMeta(data, config)

	if (config.remcostoeten.enabled) {
		remcoTrackEvent(name, meta, {
			projectId: config.remcostoeten.projectId,
			ingestUrl: config.remcostoeten.ingestUrl,
			debug: config.remcostoeten.debug ?? config.debug
		})
	}

	if (config.vercel.enabled && config.vercel.trackCustomEvents) {
		vercelTrack(name, toVercelProperties(meta))
	}

	logEvent('event', name, meta, config)
}

/**
 * Tracks a page view manually.
 *
 * The React provider already auto-observes page views for most browser/router setups,
 * so only call this in apps that do not mount `AnalyticsProvider` or need manual routes.
 */
export function page(path?: string, title?: string, data?: Record<string, unknown>): void {
	const config = currentConfig
	if (!hasAnalyticsConsent(config)) return

	const meta = toAnalyticsMeta({ path, title, ...data }, config)

	if (config.remcostoeten.enabled) {
		remcoTrackPageView(meta, {
			projectId: config.remcostoeten.projectId,
			ingestUrl: config.remcostoeten.ingestUrl,
			debug: config.remcostoeten.debug ?? config.debug
		})
	}

	logEvent('pageview', path ?? 'current', meta, config)
}

/** Identifies an anonymized user/session without storing raw personal data by default. */
export function identify(userId: string, data?: Record<string, unknown>): void {
	const config = currentConfig
	if (!hasAnalyticsConsent(config)) return

	const traits = toAnalyticsMeta({ userId, ...data }, config)
	const userProperties = toPrimitiveProperties(traits)

	if (config.remcostoeten.enabled) {
		remcoIdentifyUser(userProperties, {
			projectId: config.remcostoeten.projectId,
			ingestUrl: config.remcostoeten.ingestUrl,
			debug: config.remcostoeten.debug ?? config.debug
		})
	}

	if (config.vercel.enabled && config.vercel.trackCustomEvents) {
		vercelTrack('identify', toVercelProperties(traits))
	}

	logEvent('identify', userId, traits, config)
}

/** Tracks an application error without leaking sensitive metadata. */
export function captureError(error: Error, data?: Record<string, unknown>): void {
	const config = currentConfig
	if (!hasAnalyticsConsent(config)) return

	const meta = toAnalyticsMeta(data, config)

	if (config.remcostoeten.enabled) {
		remcoTrackError(error, meta, {
			projectId: config.remcostoeten.projectId,
			ingestUrl: config.remcostoeten.ingestUrl,
			debug: config.remcostoeten.debug ?? config.debug
		})
	}

	if (config.vercel.enabled && config.vercel.trackCustomEvents) {
		vercelTrack('error', toVercelProperties({ message: error.message, ...meta }))
	}

	logEvent('error', error.message, meta, config)
}

function toAnalyticsMeta(
	data: Record<string, unknown> | undefined,
	config: AnalyticsConfig
): AnalyticsMeta {
	if (!data) return {}

	const result: AnalyticsMeta = {}

	for (const [key, value] of Object.entries(data)) {
		if (config.privacy.stripSensitiveMetadata && SENSITIVE_KEY_PATTERN.test(key)) continue
		const sanitized = sanitizeValue(value, config, 0)
		if (sanitized !== undefined) result[key] = sanitized
	}

	return result
}

function sanitizeValue(value: unknown, config: AnalyticsConfig, depth: number): AnalyticsMeta[string] {
	if (depth > 4) return '[MaxDepth]'
	if (value == null) return null
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeValue(item, config, depth + 1) ?? null)
	}
	if (typeof value === 'object') {
		const nested: Record<string, AnalyticsMeta[string]> = {}
		for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
			if (config.privacy.stripSensitiveMetadata && SENSITIVE_KEY_PATTERN.test(key)) continue
			const sanitized = sanitizeValue(nestedValue, config, depth + 1)
			if (sanitized !== undefined) nested[key] = sanitized
		}
		return nested
	}
	return String(value)
}

function toPrimitiveProperties(meta: AnalyticsMeta): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {}

	for (const [key, value] of Object.entries(meta)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			result[key] = value
		}
	}

	return result
}

function toVercelProperties(meta: AnalyticsMeta): Record<string, string | number | boolean> {
	const result: Record<string, string | number | boolean> = {}

	for (const [key, value] of Object.entries(meta)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			result[key] = value
		} else if (value != null) {
			result[key] = JSON.stringify(value)
		}
	}

	return result
}

function logEvent(type: string, name: string, meta: AnalyticsMeta, config: AnalyticsConfig): void {
	if (!config.console.enabled) return
	if (typeof console === 'undefined') return

	console.groupCollapsed(`[analytics:${type}] ${name}`)
	console.log('meta:', meta)
	console.log('providers:', {
		remcostoeten: config.remcostoeten.enabled,
		vercel: config.vercel.enabled && config.vercel.trackCustomEvents
	})
	console.groupEnd()
}

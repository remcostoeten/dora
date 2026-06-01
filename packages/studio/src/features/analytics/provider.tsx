'use client'

import { Analytics as RemcoAnalytics } from '@remcostoeten/analytics'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { useEffect, useMemo } from 'react'
import { hasAnalyticsConsent, setAnalyticsConfig } from './client'
import { resolveAnalyticsConfig } from './config'
import type { AnalyticsProviderProps } from './types'

/**
 * Mounts all browser analytics providers in one place.
 *
 * This component is intentionally framework-light: it works in Vite/React Router and
 * can be copied into a Next.js app as a client component under `app/providers.tsx`.
 */
export function AnalyticsProvider({ children, config }: AnalyticsProviderProps) {
	const resolvedConfig = useMemo(() => resolveAnalyticsConfig(config), [config])
	const enabled = hasAnalyticsConsent(resolvedConfig)

	useEffect(() => {
		setAnalyticsConfig(config)
	}, [config])

	return (
		<>
			{children}
			{enabled && resolvedConfig.remcostoeten.enabled ? (
				<RemcoAnalytics
					projectId={resolvedConfig.remcostoeten.projectId}
					ingestUrl={resolvedConfig.remcostoeten.ingestUrl}
					debug={resolvedConfig.remcostoeten.debug ?? resolvedConfig.debug}
				/>
			) : null}
			{enabled && resolvedConfig.vercel.enabled ? <VercelAnalytics /> : null}
		</>
	)
}

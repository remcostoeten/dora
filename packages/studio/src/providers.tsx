import type { ReactNode } from 'react'
import { DataProvider } from '@studio/core/data-provider'
import { PendingEditsProvider } from '@studio/core/pending-edits'
import { SettingsProvider } from '@studio/core/settings'
import { AnalyticsProvider } from '@studio/features/analytics'
import type { AnalyticsConfig } from '@studio/features/analytics'
import { QueryHistoryProvider } from '@studio/features/sql-console/stores/query-history-store'
import { TooltipProvider } from '@studio/shared/ui/tooltip'

type AppProvidersProps = {
	/** Force the in-memory mock adapter (web demo). */
	forceMock?: boolean
	/** Analytics configuration for the host. */
	analyticsConfig: AnalyticsConfig
	children: ReactNode
}

/**
 * The application-wide context providers, composed in one place.
 *
 * This is the single home for global providers so that any component — in the
 * app or in a test — can rely on them being present. Infrastructure providers
 * that must wrap routing (BrowserRouter, QueryClientProvider) stay in
 * `studio-app.tsx`; everything app-scoped lives here.
 *
 * `TooltipProvider` belongs here (not deep inside a page) so every tooltip in
 * the tree has a provider ancestor without each surface re-wrapping one.
 */
export function AppProviders({ forceMock = false, analyticsConfig, children }: AppProvidersProps) {
	return (
		<AnalyticsProvider config={analyticsConfig}>
			<SettingsProvider>
				<PendingEditsProvider>
					<DataProvider forceMock={forceMock}>
						<QueryHistoryProvider>
							<TooltipProvider>{children}</TooltipProvider>
						</QueryHistoryProvider>
					</DataProvider>
				</PendingEditsProvider>
			</SettingsProvider>
		</AnalyticsProvider>
	)
}

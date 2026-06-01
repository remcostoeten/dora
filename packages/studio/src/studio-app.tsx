import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'
import { Routes, Route } from 'react-router-dom'
import { DemoBanner } from '@studio/components/demo-banner'
import { Toaster } from '@studio/shared/ui/notifier'
import { DataProvider } from '@studio/core/data-provider'
import { PendingEditsProvider } from '@studio/core/pending-edits'
import { SettingsProvider, useSettings } from '@studio/core/settings'
import { AnalyticsProvider } from '@studio/features/analytics'
import type { AnalyticsConfig } from '@studio/features/analytics'
import { QueryHistoryProvider } from '@studio/features/sql-console/stores/query-history-store'
import { ThemeSync } from '@studio/features/sidebar/components/theme-sync'
import Index from '@studio/pages/Index'
import NotFound from '@studio/pages/NotFound'

const queryClient = new QueryClient()

function GlobalToaster() {
	const { settings } = useSettings()
	if (settings.showToasts === false) return null
	return <Toaster />
}

type Props = {
	/** Force the in-memory mock adapter (web demo). Desktop leaves this false so Tauri is auto-detected. */
	forceMock?: boolean
	/** Analytics configuration for the host (desktop passes desktopAnalyticsConfig). */
	analyticsConfig: AnalyticsConfig
}

/**
 * The whole Studio application: provider stack + routed views.
 *
 * Router is intentionally NOT included here — the host wraps this in the
 * appropriate router (desktop: `<BrowserRouter>`; marketing: `<BrowserRouter basename="/app">`),
 * which keeps the nuqs react-router adapter and `useSearchParams` working in both.
 */
export function StudioApp({ forceMock = false, analyticsConfig }: Props) {
	return (
		<QueryClientProvider client={queryClient}>
			<AnalyticsProvider config={analyticsConfig}>
				<SettingsProvider>
					<PendingEditsProvider>
						<DataProvider forceMock={forceMock}>
							<QueryHistoryProvider>
								<div className='flex flex-col h-screen'>
									<DemoBanner />
									<div className='flex-1 overflow-hidden'>
										<GlobalToaster />
										<NuqsAdapter>
											<ThemeSync />
											<Routes>
												<Route path='/' element={<Index />} />
												<Route path='*' element={<NotFound />} />
											</Routes>
										</NuqsAdapter>
									</div>
								</div>
							</QueryHistoryProvider>
						</DataProvider>
					</PendingEditsProvider>
				</SettingsProvider>
			</AnalyticsProvider>
		</QueryClientProvider>
	)
}

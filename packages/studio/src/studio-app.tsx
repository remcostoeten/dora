import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CredentialStorageNotice } from '@studio/components/credential-storage-notice'
import { DemoBanner } from '@studio/components/demo-banner'
import { Toaster } from '@studio/shared/ui/notifier'
import { useSettings } from '@studio/core/settings'
import type { AnalyticsConfig } from '@studio/features/analytics'
import { ThemeSync } from '@studio/features/sidebar/components/theme-sync'
import { AppProviders } from '@studio/providers'
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
	/** Router basename. Desktop runs at root; marketing mounts the app under `/app`. */
	basename?: string
}

/**
 * The whole Studio application: router + provider stack + routed views.
 *
 * The router lives here (not in the host) so there is exactly ONE react-router
 * instance — hosting `<BrowserRouter>` separately in each app loaded a second
 * copy of react-router and broke the Router context (`useLocation` outside a
 * `<Router>`). Hosts differ only by `basename`.
 */
export function StudioApp({ forceMock = false, analyticsConfig, basename }: Props) {
	return (
		<BrowserRouter basename={basename}>
			<QueryClientProvider client={queryClient}>
				<AppProviders forceMock={forceMock} analyticsConfig={analyticsConfig}>
					<div className='flex flex-col h-screen'>
						<DemoBanner />
						<CredentialStorageNotice />
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
				</AppProviders>
			</QueryClientProvider>
		</BrowserRouter>
	)
}

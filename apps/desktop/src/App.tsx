import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6'
import { DemoBanner } from '@/components/demo-banner'
import { Toaster as Sonner } from '@/shared/ui/sonner'
import { Toaster } from '@/shared/ui/toaster'
import { DataProvider } from '@/core/data-provider'
import { PendingEditsProvider } from '@/core/pending-edits'
import { SettingsProvider, useSettings } from '@/core/settings'
import { AnalyticsProvider } from '@/features/analytics'
import { desktopAnalyticsConfig } from '@/features/analytics/desktop-config'
import { QueryHistoryProvider } from '@/features/sql-console/stores/query-history-store'
import { ThemeSync } from '@/features/sidebar/components/theme-sync'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
const queryClient = new QueryClient()

function GlobalToaster() {
	const { settings } = useSettings()
	if (settings.showToasts === false) return null
	return (
		<>
			<Toaster />
			<Sonner />
		</>
	)
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AnalyticsProvider config={desktopAnalyticsConfig}>
				<SettingsProvider>
					<PendingEditsProvider>
						<DataProvider>
							<QueryHistoryProvider>
								<div className='flex flex-col h-screen'>
									<DemoBanner />
									<div className='flex-1 overflow-hidden'>
										<GlobalToaster />
										<BrowserRouter>
											<NuqsAdapter>
												<ThemeSync />
												<Routes>
													<Route path='/' element={<Index />} />
													<Route path='*' element={<NotFound />} />
												</Routes>
											</NuqsAdapter>
										</BrowserRouter>
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

export default App

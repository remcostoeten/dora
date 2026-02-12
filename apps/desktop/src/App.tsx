import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { DemoBanner } from "@/components/demo-banner"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { Toaster } from "@/components/ui/toaster"
import { DataProvider } from "@/core/data-provider"
import { PendingEditsProvider } from "@/core/pending-edits"
import { RecordingProvider, RecordingOverlay } from "@/core/recording"
import { SettingsProvider, useSettings } from "@/core/settings"
import { QueryHistoryProvider } from "@/features/sql-console/stores/query-history-store"
import { ThemeSync } from "@/features/sidebar/components/theme-sync"
import Index from "./pages/Index"
import NotFound from "./pages/NotFound"
import { Analytics } from "@vercel/analytics/react"

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
        <RecordingProvider>
            <Analytics />
            <QueryClientProvider client={queryClient}>
                <SettingsProvider>
                    <PendingEditsProvider>
                        <DataProvider>
                            <QueryHistoryProvider>
                                <RecordingOverlay />
                                <div className="flex flex-col h-screen">
                                    <DemoBanner />
                                    <div className="flex-1 overflow-hidden">
                                        <GlobalToaster />
                                        <BrowserRouter>
                                            <ThemeSync />
                                            <Routes>
                                                <Route
                                                    path="/"
                                                    element={<Index />}
                                                />
                                                <Route
                                                    path="*"
                                                    element={<NotFound />}
                                                />
                                            </Routes>
                                        </BrowserRouter>
                                    </div>
                                </div>
                            </QueryHistoryProvider>
                        </DataProvider>
                    </PendingEditsProvider>
                </SettingsProvider>
            </QueryClientProvider>
        </RecordingProvider>
    )
}

export default App

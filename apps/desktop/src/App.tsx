import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "@/core/data-provider";
import { SettingsProvider, useSettings } from "@/core/settings";
import { PendingEditsProvider } from "@/core/pending-edits";
import { DemoBanner } from "@/components/demo-banner";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function GlobalToaster() {
    const { settings } = useSettings();
    if (settings.showToasts === false) return null;
    return (
        <>
            <Toaster />
            <Sonner />
        </>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <SettingsProvider>
                <PendingEditsProvider>
                    <DataProvider>
                        <div className="flex flex-col h-screen">
                            <DemoBanner />
                            <div className="flex-1 overflow-hidden">
                                <GlobalToaster />
                                <BrowserRouter>
                                    <Routes>
                                        <Route path="/" element={<Index />} />
                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </BrowserRouter>
                            </div>
                        </div>
                    </DataProvider>
                </PendingEditsProvider>
            </SettingsProvider>
        </QueryClientProvider>
    );
}

export default App;


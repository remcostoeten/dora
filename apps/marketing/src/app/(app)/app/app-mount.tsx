'use client'

import dynamic from 'next/dynamic'

function isCaptureSession() {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('capture') === '1'
}

/**
 * Loads the studio app client-side only.
 *
 * The studio is a fully client-rendered SPA (react-router, monaco, Tauri-style
 * globals) that touches `document`/`window` during render, so it must never be
 * server-rendered or prerendered. `ssr: false` (only allowed inside a client
 * component) guarantees it loads in the browser.
 */
const AppClient = dynamic(() => import('./app-client').then((m) => m.AppClient), {
    ssr: false,
    loading: function Loading() {
        if (isCaptureSession()) {
            return (
                <div
                    className="h-screen w-full bg-background"
                    aria-hidden="true"
                />
            )
        }

        return (
            <div className="deferred-label flex h-screen w-full items-center justify-center bg-background text-sm text-muted-foreground">
                Loading Dora…
            </div>
        )
    }
})

export default function AppMount() {
    return <AppClient />
}

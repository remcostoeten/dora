'use client'

import { StudioApp, createAnalyticsConfig } from '@dora/studio'

const analyticsConfig = createAnalyticsConfig({
    environment: process.env.NODE_ENV,
    enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false',
    remcostoeten: {
        enabled: true,
        projectId: process.env.NEXT_PUBLIC_ANALYTICS_PROJECT_ID ?? 'dora-landing',
        ingestUrl: process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL ?? 'https://ingestion.remcostoeten.nl',
    },
    vercel: {
        enabled: process.env.NODE_ENV === 'production',
        trackCustomEvents: false,
    },
})

export function AppClient() {
    return <StudioApp forceMock basename="/app" analyticsConfig={analyticsConfig} />
}

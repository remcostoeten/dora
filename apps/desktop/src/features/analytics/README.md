# Analytics feature

This feature is the single analytics entry point for Dora.

It wraps:

- `@remcostoeten/analytics` for first-party, privacy-focused product analytics.
- `@vercel/analytics` for optional Vercel page/application insights.
- A console provider for development logging.

## Why this exists

Application code should not import analytics vendors directly. Use the exported facade instead:

- `track(name, data)`
- `page(path, title, data)`
- `identify(userId, data)`
- `captureError(error, data)`
- React hooks such as `useTrack()`

The facade strips common sensitive metadata keys before events leave the client.

## Vite usage

```tsx
import { AnalyticsProvider } from '@/features/analytics'
import { desktopAnalyticsConfig } from '@/features/analytics/desktop-config'

export function Providers({ children }: { children: React.ReactNode }) {
	return <AnalyticsProvider config={desktopAnalyticsConfig}>{children}</AnalyticsProvider>
}
```

## Next.js usage

Create a client provider and pass `NEXT_PUBLIC_*` values into `createAnalyticsConfig`. Import from `@/features/analytics`, not `desktop-config`, so the Next.js bundle stays free of Vite-only `import.meta.env` code:

```tsx
'use client'

import { AnalyticsProvider, createAnalyticsConfig } from '@/features/analytics'

const analyticsConfig = createAnalyticsConfig({
	environment: process.env.NODE_ENV,
	enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true',
	remcostoeten: {
		enabled: true,
		projectId: process.env.NEXT_PUBLIC_ANALYTICS_PROJECT_ID,
		ingestUrl: process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL
	},
	vercel: {
		enabled: process.env.NODE_ENV === 'production',
		trackCustomEvents: false
	}
})

export function Providers({ children }: { children: React.ReactNode }) {
	return <AnalyticsProvider config={analyticsConfig}>{children}</AnalyticsProvider>
}
```

## Recommended env vars

- `VITE_ANALYTICS_ENABLED` / `NEXT_PUBLIC_ANALYTICS_ENABLED`
- `VITE_ANALYTICS_DEBUG` / `NEXT_PUBLIC_ANALYTICS_DEBUG`
- `VITE_ANALYTICS_PROJECT_ID` / `NEXT_PUBLIC_ANALYTICS_PROJECT_ID`
- `VITE_ANALYTICS_INGEST_URL` / `NEXT_PUBLIC_ANALYTICS_INGEST_URL`
- `VITE_VERCEL_ANALYTICS_ENABLED` / `NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED`

## Privacy notes

The sanitizer removes keys matching passwords, tokens, secrets, API keys, cookies, connection strings, database URLs, DSNs and raw SQL/query values. Prefer event names and aggregate counts over storing user data.

# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Dora marketing site (`apps/marketing`). PostHog is initialized client-side via `instrumentation-client.ts` (Next.js 15.3+ pattern) with a reverse proxy through `/ingest` to avoid ad blockers. A server-side client (`src/lib/posthog-server.ts`) handles the OAuth API routes. Eleven conversion and engagement events are now tracked across the hero, downloads page, feature detail pages, providers section, GitHub stats widget, and the Supabase OAuth proxy endpoints.

| Event name | Description | File |
|---|---|---|
| `download_clicked` | User clicks the primary download button in the hero section. | `src/components/hero.tsx` |
| `download_os_tab_switched` | User switches the OS platform tab in the hero download widget. | `src/components/hero.tsx` |
| `all_downloads_link_clicked` | User clicks the 'All downloads →' link in the hero to navigate to the full downloads page. | `src/components/hero.tsx` |
| `downloads_page_format_selected` | User clicks a specific platform/format download link on the dedicated downloads page. | `src/views/downloads-view.tsx` |
| `feature_download_cta_clicked` | User clicks the 'Download Dora' CTA at the bottom of a feature detail page. | `src/views/feature-detail-view.tsx` |
| `feature_web_demo_cta_clicked` | User clicks the 'Open web demo' CTA at the bottom of a feature detail page. | `src/views/feature-detail-view.tsx` |
| `provider_engaged` | User keyboard-focuses a database provider in the providers showcase section. | `src/components/providers-section.tsx` |
| `supabase_oauth_started` | Desktop app opens the Supabase OAuth flow via the marketing proxy endpoint. | `src/app/api/oauth/supabase/start/route.ts` |
| `supabase_oauth_completed` | Supabase OAuth token exchange succeeds and tokens are returned to the desktop app. | `src/app/api/oauth/supabase/callback/route.ts` |
| `supabase_oauth_failed` | Supabase OAuth flow fails due to an error, denial, or missing parameters. | `src/app/api/oauth/supabase/callback/route.ts` |
| `github_stats_day_expanded` | User clicks a day on the GitHub commit-activity graph to see commit details. | `src/components/github-stats/index.tsx` |

## Files created or modified

- **`instrumentation-client.ts`** (new) — PostHog client-side initialization using Next.js 15.3+ instrumentation hook
- **`next.config.ts`** (modified) — Added `/ingest/*` rewrites for PostHog reverse proxy and `skipTrailingSlashRedirect: true`
- **`src/lib/posthog-server.ts`** (new) — Singleton `getPostHogClient()` using `posthog-node` for server-side capture
- **`src/components/hero.tsx`** (modified) — Added `download_clicked`, `download_os_tab_switched`, `all_downloads_link_clicked`
- **`src/components/providers-section.tsx`** (modified) — Added `provider_engaged` on keyboard focus
- **`src/components/feature-cta-buttons.tsx`** (new) — Client component wrapping the feature page CTAs with PostHog capture
- **`src/views/feature-detail-view.tsx`** (modified) — Replaced inline CTA links with `<FeatureCtaButtons />`
- **`src/components/tracked-download-link.tsx`** (new) — Client component wrapping download links with `downloads_page_format_selected` capture
- **`src/views/downloads-view.tsx`** (modified) — Replaced `<a>` links with `<TrackedDownloadLink />`
- **`src/components/github-stats/index.tsx`** (modified) — Added `github_stats_day_expanded` in `handleDayClick`
- **`src/app/api/oauth/supabase/start/route.ts`** (modified) — Added `supabase_oauth_started` server-side capture
- **`src/app/api/oauth/supabase/callback/route.ts`** (modified) — Added `supabase_oauth_completed` and `supabase_oauth_failed` server-side capture
- **`apps/marketing/.env.local`** — Added `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`

## Next steps

We've built a dashboard and five insights to track user behavior based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/501940/dashboard/1811536)
- [Downloads over time](https://us.posthog.com/project/501940/insights/rUMtz3Hs) — Daily download button clicks
- [Downloads by OS platform](https://us.posthog.com/project/501940/insights/78MN6aN0) — Breakdown of downloads by macOS / Windows / Linux
- [Feature page CTAs](https://us.posthog.com/project/501940/insights/qT29aotB) — "Download Dora" vs "Open web demo" CTA comparison
- [Supabase OAuth conversion funnel](https://us.posthog.com/project/501940/insights/mD90hahQ) — OAuth started → completed funnel
- [Provider section engagement](https://us.posthog.com/project/501940/insights/J8ClvlyA) — Which database providers users engage with most

## Verify before merging

- [ ] Run a full production build (`bun run build` in `apps/marketing`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

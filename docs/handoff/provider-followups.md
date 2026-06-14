# Handoff: hosted-provider & dialect follow-ups

Durable handoff so a fresh session (after `/clear`) can pick up without prior context.
Trigger by telling Claude e.g. "do the SEO follow-up from the handoff doc".

## Current state (as of 2026-06-14)

Open PR stack (merge in order; base → head):
- **#118** features + fixes → `master` (branch `feat/multi-connection-explain-dialect-foundation`)
- **#119** dialect-as-engine-field seam (keystone, zero behavior change) → #118 (`feat/dialect-engine-seam`)
- **#120** CockroachDB + MariaDB introspection/type parity → #119 (`feat/dialect-overrides`)
- **#121** hosted/serverless provider detection + root `providers.tsx` → #120 (`feat/hosted-provider-support`)

Repo: `/home/remcostoeten/dev/dora`. Architecture spec: `docs/architecture/data-sources.md`
(three tiers — model / engine / dialect — + capability descriptor; enum-as-strategy).

Key facts:
- No hosted platform needs a new backend adapter — all speak standard Postgres/MySQL/libSQL wire.
- ~18 hosted providers auto-detected in `packages/studio/src/features/connections/utils/providers.ts`
  (engine + dialect + SSL). 70 tests in `__tests__/providers.test.ts`.
- `TooltipProvider` now lives at root in `packages/studio/src/providers.tsx` (`AppProviders`).
- Verify commands: `bun run --cwd packages/studio typecheck` and `bun run --cwd packages/studio test`
  (~359 tests). Marketing has no clean isolated typecheck (pre-existing cross-package monaco/`__DORA_CAPTURE_MODE` noise — ignore).
- Live DBs for dialect testing: `docker exec dora-cockroach cockroach sql --insecure --host=127.0.0.1:26257 -d defaultdb -e "..."`
  and `docker exec mariadb mariadb -uroot -prootpass dora -e "..."`.

Other known gaps (not in the 3 prompts below): multi-version dialect certification;
unify the two `SourceCaps` definitions (frontend `source-caps.ts` + backend `dialect.rs`);
AI-provider manual QA with real keys; blob raw-bytes for MySQL/DuckDB (#90).

---

## Follow-up 1 — SEO: per-provider connection guides

You are adding per-provider connection guides to Dora's marketing site for SEO. New branch off `master` (or off `feat/hosted-provider-support` if unmerged — check `gh pr list`).

CONTEXT: Dora connects to many hosted Postgres/MySQL/libSQL providers via standard connection strings (no special adapter). The app already auto-detects them (`packages/studio/src/features/connections/utils/providers.ts`). The marketing site has connection guides for ONLY Supabase, Neon, Turso. Add guides for the rest to capture "<provider> database GUI / desktop client / SQL client" search traffic.

PRIMARY FILE: `apps/marketing/src/core/config/guides.ts` — read it fully; mirror the existing Supabase/Neon/Turso entries' `TGuideConfig` shape EXACTLY: { slug, provider, logo, title, description, lead, keywords[], sections[{title, body}], tips[] }.

ADD GUIDES (priority order): Railway, Fly.io, Aiven, Render, DigitalOcean, PlanetScale, AWS RDS, CockroachDB Cloud, TiDB Cloud, Vercel Postgres, Crunchy Bridge, Timescale Cloud, Azure Database, Google Cloud SQL, Yugabyte.

EACH MUST COVER: where to find the connection string in that dashboard; that it's standard Postgres/MySQL/libSQL (no special setup); SSL note (Dora applies it automatically). HONESTY CAVEATS where relevant:
- Fly.io: external needs `fly proxy 5432` to localhost, or `.internal`/`.flycast` over WireGuard — a Fly networking step, not a Dora limit.
- PlanetScale: MySQL-compatible but NO foreign-key constraints (Vitess); browsing/querying works.
- CockroachDB Cloud: string includes `options=--cluster=<id>` and `sslmode=verify-full` — keep both; Dora has full CockroachDB dialect support.
- AWS RDS: SSL is optional (don't say required).

LOGOS: `logo: '/providers/<name>.svg'`. Check `apps/marketing/public/providers/`. If missing, reuse closest/base-engine logo + `// TODO: add <provider> logo`. Don't block on assets.

ALSO: update `apps/marketing/src/core/config/site.ts` and `features.ts` provider keyword lists. Verify the guides index page renders new entries (likely maps the array — confirm).

VERIFY: No clean isolated marketing typecheck (pre-existing cross-package errors — ignore). Match `TGuideConfig` exactly. Run a fast lint if available.

Report: slugs added, logo fallbacks/TODOs, how the index picks them up.

---

## Follow-up 2 — Fly.io proxy in-app hint

You are improving Dora's Fly.io connection UX. New branch off `master` (or `feat/hosted-provider-support` if unmerged).

PROBLEM: Fly.io Postgres can't be reached directly from a desktop client over the public internet — users must run `fly proxy 5432 -a <app>` (forward to localhost) or use the `.internal`/`.flycast` host over a Fly WireGuard tunnel. Dora detects Fly hosts but gives no guidance, so attempts time out confusingly.

ALREADY DONE: `packages/studio/src/features/connections/utils/providers.ts` detects Fly hosts (`fly.dev`, `flympg`, `.flycast`, `.internal`; name "Fly.io Postgres"). Read `detectProviderName`/`parseConnectionUrl`/`PROVIDER_PATTERNS`.

TASK: When the host matches a Fly PUBLIC pattern (`fly.dev`/`flympg`, NOT private `.internal`/`.flycast`), show an inline dismissible hint in the connection dialog: "Fly.io databases aren't reachable directly. Run `fly proxy 5432 -a <your-app>` then connect to localhost:5432 — or use the .internal/.flycast host over a Fly WireGuard tunnel."

STEPS:
1. Connection dialog: `packages/studio/src/features/connections/components/connection-dialog/` + `connection-form.tsx`. See existing provider notices (Supabase SSL note, `hasPostgresPoolerMode` hints) and mirror.
2. Add helper `isFlyPublicHost(url): boolean` in/near providers.ts (true for fly.dev/flympg public, false for `.internal`/`.flycast`).
3. Render a subtle dismissible info callout when it matches (reuse existing Notice/Callout/Alert component). Do NOT show for `.internal`/`.flycast`.
4. Purely informational — never blocks connecting.

VERIFY: `bun run --cwd packages/studio typecheck` (clean) + `bun run --cwd packages/studio test` (~359; don't break). Add a unit test for `isFlyPublicHost` in `__tests__/providers.test.ts`.

Report: helper added, where the hint renders, exact copy, results.

---

## Follow-up 3 — First-class connection presets

You are making hosted providers first-class presets in Dora's connect dialog. New branch off `master` (or `feat/hosted-provider-support` if unmerged).

CONTEXT: Dora auto-detects ~18 hosted providers from the connection string (engine+dialect+SSL) in `packages/studio/src/features/connections/utils/providers.ts`. But they're NOT first-class presets — the connect dialog offers a limited `DbPreset` set; new providers reuse generic labels/icons. A prior pass deferred this because `DbPreset` is an exhaustive union threaded through several files. Do it cleanly.

READ FIRST:
- `source-kinds.ts` — `DbPreset` union (postgres, neon, supabase, cockroach, mysql, mariadb, planetscale, sqlite, duckdb, libsql, turso, generic) + `SourceMeta`.
- `resolve-source.ts` — `resolvePresetToEngine` (EXHAUSTIVE switch), `inferPresetFromConnection`.
- `source-labels.ts` — `resolveProviderLabel` (switch).
- `components/database-icons.tsx`, `database-type-icon.tsx` — icons.
- `components/connection-dialog/` + `database-type-selector.tsx` — preset picker UI.

TASK: Add first-class presets for: railway, fly, aiven, render, vercel, digitalocean, timescale, crunchy, cockroach-cloud (→ cockroach dialect), tidb (→ mysql). Each needs: (1) `DbPreset` member; (2) `resolvePresetToEngine` case → base engine; (3) `resolveProviderLabel` branded name; (4) icon (reuse base-engine icon if no brand SVG + `// TODO: brand icon`; check `apps/marketing/public/providers/*.svg`); (5) `inferPresetFromConnection` so a pasted string auto-selects it (keep in sync with PROVIDER_PATTERNS — ideally derive one from the other); (6) surface in `database-type-selector.tsx` with default ports/SSL from `getConnectionDefaults`/`PROVIDER_CONFIGS`.

CONSISTENCY: SSL/engine mapping MUST match utils/providers.ts (reuse its helpers; don't create a second source of truth). cockroach-cloud uses the existing full CockroachDB dialect; planetscale/tidb are MySQL-wire.

VERIFY: `bun run --cwd packages/studio typecheck` (the exhaustive switches will error until every preset is handled — that's the safety net) + `bun run --cwd packages/studio test` (~359; add cases to `__tests__/providers.test.ts`).

Report: presets added, each engine mapping + label + icon (or TODO), how inference stays in sync, dialog changes, results.

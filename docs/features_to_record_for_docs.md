# Docs media recording checklist

Shot list for the docs site. Nothing in `docs/**/*.mdx` currently embeds any image, video, or GIF.

## Conventions

- **Format:** WebM video + PNG poster. No GIFs anywhere in this project.
- **Location:** `apps/marketing/public/`. Existing feature captures live at `public/features/<slug>.webm` + `<slug>.png` (see `apps/marketing/src/core/config/feature-captures.ts`).
- **Component:** `apps/marketing/src/components/doc-media-asset.tsx` (`DocMediaAsset`) handles video/image, poster, caption, and `prefers-reduced-motion`. It is **not yet registered** in `apps/marketing/src/components/mdx-components.tsx`, so MDX cannot reference it until it is added there.
- `docs/assets/` is outside Next's `public/` dir and is not served. Anything there must be copied into `apps/marketing/public/` before a docs page can use it.

## Tier 1 - video, blocking

Features whose value is the interaction; prose cannot carry them.

| Page | Capture |
| --- | --- |
| `guides/command-palette` | Ctrl+K open, fuzzy search, jump to table |
| `guides/ai-assistant` | Natural-language prompt to generated SQL to result grid |
| `guides/schema-visualizer` | Pan/zoom the diagram, follow a foreign key |
| `guides/sql-console` | Type query, run, results, error state |
| `guides/data-studio` | Inline cell edit, commit, row add/delete |
| `guides/orm-runners` | Already recorded at `docs/assets/recordings/drizzle-update-lsp-demo.webm`. Copy into `public/`. |

## Tier 2 - video, lower urgency

| Page | Capture |
| --- | --- |
| `guides/live-monitoring` | Rows updating in real time (only meaningful as video) |
| `guides/docker-manager` | Start/stop a container, connect to it |
| `guides/orm-cockpit` | Cockpit walkthrough. Also fills a marketing gap (see below). |
| `guides/charts` | Build a chart from a result set |
| `guides/export` | Pick format, export, done |

## Tier 3 - static screenshots only

`getting-started`, `installation`, and the 19 `connect/*` provider pages. These are copy-a-connection-string flows; a still of the connection dialog is enough. Per-provider video would not be maintainable.

## Skip

`api`, `types`, `go-cli-runner`, `guides/security`, `guides/mock-data`. Reference material, nothing to show.

## Open questions

1. `ai-assistant`, `docker-containers`, `drizzle-runner`, and `schema-visualization` already have marketing captures in `public/features/`. Decide whether to reuse them or record slower, instructional versions - the marketing cuts are tuned for a hero section, so they are likely too fast and too short to teach from.
2. `orm-cockpit` and `analytics` are in `FEATURE_SLUGS_WITHOUT_VIDEO` and run animated React mocks on marketing rather than real captures. Recording them upgrades the marketing page and fills the docs gap in one pass.

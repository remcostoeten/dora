# Version 0.30.0

**Date:** 2026-06-20
**Tag:** `v0.30.0`
**Range:** `v0.29.0..main`

## Why this release exists

`v0.30.0` opens up two new fronts: an ORM cockpit that connects your schema code
to the live database, and a batch of serverless and edge database connectors.

## Changes

- **ORM Cockpit:** link a Drizzle or Prisma project folder, diff its schema
  against the live database, and preview a dialect-correct migration. Drift is
  grouped per table and flagged safe / review / destructive, with review and
  destructive statements gated behind explicit opt-in before any SQL reaches the
  console (#151–#155).
- **Cloudflare D1 connector:** connect with an API token and pick a database
  from your account. A native HTTP query engine, no local file required
  (#139, #150).
- **PlanetScale connector:** connect with a service token and pick a branch
  (#141, #149).
- **Vercel Postgres connector:** connect with a token and pick a store from your
  account (#147).
- **Xata connector:** connect with a key and pick a database from your account
  (#140, #148).
- **Neon branch-aware connects:** pick a branch when a project has more than one
  (#142, #156).
- **Multiple open connections:** keep several databases connected at once, each
  with its own isolated tab group, switchable from a connection bar. Cycle with
  `Ctrl+Shift+[` / `Ctrl+Shift+]` (#96).
- **Hardened Turso / Supabase / Neon connects with account visibility:** robust
  Turso CLI detection and in-app sign-in, plus "Connected as", a refresh button,
  paginated project lists, and clearer empty and error states for each.
- **MySQL in the Docker manager:** spin up a local MySQL container in one click
  alongside PostgreSQL, MariaDB, and CockroachDB, with version presets, an
  auto-detected free port, connect-in-data-viewer, SQL seeding, and Compose
  export. The bundled `docker-compose.databases.yml` now also covers PostgreSQL,
  MySQL, MariaDB, CockroachDB, and libSQL/sqld for one-command local testing.
- Clearer, consistent AI provider error copy across Groq, OpenAI, Anthropic,
  Gemini, and Ollama (#82).

## Fixes

- Data-grid optimistic cell edits no longer flash back to the stale value before
  the save lands.
- The sidebar no longer blanks out on table rename, duplicate, or drop.

## Performance

- The marketing home page ships ~24.7 kB less gzipped JS on first load (-8.6%) by
  deferring the animation engine until after hydration. First paint is pure CSS,
  so there is no perceived change.

## Documentation

- New end-user installation matrix covering macOS, Windows, Linux, and the AUR.
- New connect guides for Cloudflare D1 and Xata.
- New ORM Cockpit and ORM Runners guides.

## Closed issues

Completed since `v0.29.0`:

- ORM & migration cockpit (Pillar 2): [#143](https://github.com/remcostoeten/dora/issues/143), [#144](https://github.com/remcostoeten/dora/issues/144), [#145](https://github.com/remcostoeten/dora/issues/145), [#146](https://github.com/remcostoeten/dora/issues/146)
- Cloudflare D1 connector: [#139](https://github.com/remcostoeten/dora/issues/139)
- Xata connector: [#140](https://github.com/remcostoeten/dora/issues/140)
- PlanetScale connector: [#141](https://github.com/remcostoeten/dora/issues/141)
- Branch-aware connects (PlanetScale / Neon): [#142](https://github.com/remcostoeten/dora/issues/142)
- Docs site: [#130](https://github.com/remcostoeten/dora/issues/130)
- Installation & distribution matrix: [#131](https://github.com/remcostoeten/dora/issues/131)
- Provider & dialect reference: [#132](https://github.com/remcostoeten/dora/issues/132)
- Serverless & hosted provider showcase: [#133](https://github.com/remcostoeten/dora/issues/133)
- Full feature showcase: [#134](https://github.com/remcostoeten/dora/issues/134)

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`, `.snap`, `.tar.gz`
- macOS: `.dmg` (Apple Silicon and Intel)
- Windows: `.exe`, `.msi`

# Version 0.0.105

**Date:** 2026-04-17
**Tag:** `v0.0.105`
**Range:** `v0.0.104..master`

## Why this release exists

`v0.0.105` adds the source-built Arch AUR packaging flow and hardens release automation so missing downstream artifacts do not block the rest of the release pipeline.

## Changes

- Ships a native `dora` AUR package built from source instead of the old AppImage-backed path.
- Adds automatic AUR publishing from GitHub Actions when the release is published.
- Makes the Winget workflow skip cleanly when Windows checksums are unavailable.
- Updates release-facing metadata and install references for `0.0.105`.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg`
- Windows: `.exe`, `.msi`

# Version 0.0.103

**Date:** 2026-04-12
**Tag:** `v0.0.103`
**Range:** `v0.0.102..master`

## Why this release exists

`v0.0.103` packages the MySQL-focused desktop work that landed after
`v0.0.102`, plus the current round of sidebar polish, web-demo fallbacks, and
release surface updates so every distribution channel points at the same build.

## Changes

- Ships the current MySQL connectivity and schema support work on the main
  release line.
- Improves non-Tauri behavior by persisting settings in local storage and
  exporting table data directly from the web demo.
- Expands the sidebar table info dialog and fixes rename, changelog, and
  settings panel sizing behavior.
- Refreshes release metadata, install commands, and package manager references
  for `0.0.103`.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg`
- Windows: `.exe`, `.msi`

# Version 0.0.102

**Date:** 2026-04-05
**Tag:** `v0.0.102`
**Range:** `v0.0.101..feature/package-distribution`

## Why this release exists

`v0.0.101` produced the main release assets, but the Snap workflow fixes landed immediately afterward on branch head. `v0.0.102` is the clean follow-up tag that includes those fixes.

## Changes

- Fixed Snap GitHub Actions builds to run Snapcraft correctly in destructive mode.
- Replaced the invalid Tauri `--bundles none` step with a direct Rust release build for Snap packaging.
- Keeps the packaging automation, release guidance, and VM lab tooling on the release tag itself.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg`
- Windows: `.exe`, `.msi`

# Version 0.0.101

**Date:** 2026-04-05
**Tag:** `v0.0.101`
**Range:** `v0.1.0..feature/package-distribution`

## Why this release exists

This release bundles packaging automation work, VM-based packaging workflows, release tooling, and the current round of desktop/docs/test iteration into `v0.0.101`.

## Changes

- Added release checksum generation for Windows and Linux assets.
- Added repo-native helpers for Winget, AUR, Snap, release guidance, and VM management.
- Updated the in-app changelog and release-facing documentation for the new release milestone.
- Carried forward the current desktop and documentation iteration work already present on this branch.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg`
- Windows: `.exe`, `.msi`

# Version 0.0.95

**Date:** 2026-02-09
**Tag:** `v0.0.95`
**Range:** `v0.0.94..master`

## Why this release exists

After restoring cross-platform release reliability in `v0.0.94`, this release expands distributable formats and fixes the in-app changelog panel regressions.

## Changes

- Added Linux `rpm` target.
- Added Windows `msi` target.
- Added separate Intel macOS release job.
- Fixed changelog popover crash in web mode.
- Restored scroll/navigation through older changelog entries.
- Added unseen-changes indicator on changelog trigger.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg` (arm64 + x64)
- Windows: `.exe`, `.msi`

# Version 0.0.94

**Date:** 2026-02-09
**Tag:** `v0.0.94`
**Range:** `d596a4c..df1d696` + release infrastructure fixes in this release prep

## Why this release exists

`v0.0.93` was tagged on 2026-02-06 but did not produce a GitHub release because all release workflow jobs failed (Linux dependency mismatch, Windows sqlite link failure, macOS signing import failure). `v0.0.94` restores a reliable cross-platform release flow.

## Commits since `v0.0.93`

- `4ded3ed` docs: update README with `v0.0.93` download links
- `73fafbc` fix(ci): resolve failing tests and rust compile issues
- `6654232` fix(ci): unblock rust tests in GitHub Actions
- `20e0161` fix(ci): add postgres initdb bin path for pgtemp tests
- `df1d696` fix(ci): resolve pipeline failures (#32)

## Infrastructure fixes for release generation

- Linux release dependencies updated for Tauri v2 (`libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`, etc.).
- Windows SQLite linkage stabilized by enabling `rusqlite` `bundled`.
- macOS release flow adjusted to produce unsigned CI artifacts without failing keychain import.

## Expected assets

- Linux: `.deb`, `.AppImage`
- macOS: `.dmg`
- Windows: `.exe` (NSIS)

# Version 0.0.92

## Features

- **Docker Manager MVP**: This release introduces the Docker Manager, allowing you to view and control containers, inspect logs, and manage your development environment databases directly within Dora.
- **Application Sidebar**: A fresh look for the main navigation. The new sidebar is collapsible and features smooth animations, making it easier to focus on your data.
- **URL State**: The application state is now deeply integrated with the URL. Share links to specific table views, row selections, or search queries.
- **Theme Sync**: Fixed various issues where the theme wouldn't persist or sync correctly across different parts of the application.

## Bug Fixes

- Fixed context menu positioning in the data grid.
- Resolved issues with table creation validation.

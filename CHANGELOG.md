## [v0.27.0] - 2026-06-07

# Dora v0.27.0

This release is the main multi-provider AI and shared Studio release. It turns the assistant from a single-provider helper into a fuller database copilot, moves the Studio UI into a reusable package for both the desktop app and the web demo, and tightens the release/distribution pipeline so every tagged release carries the right assets and changelog data.

## Highlights

- Adds multi-provider AI support for OpenAI, Anthropic, Gemini, Groq, and Ollama.
- Adds encrypted API key storage, provider/model selection, usage history, and task-aware model settings.
- Adds an in-app Ollama setup flow with installer/runtime helpers and model management.
- Feeds live table indexes into assistant schema context so answers can account for indexed columns, not just tables and fields.
- Adds `Ctrl+Shift+B` to toggle the AI assistant from the Studio keyboard flow.
- Extracts Dora Studio into `@dora/studio`, shared between the Tauri desktop app and the `/app` marketing web demo.
- Rebuilds the marketing landing/app demo around live product surfaces, release downloads, GitHub stats, and richer feature demos.
- Improves credential-store recovery with OS-aware keyring install actions when secure storage is unavailable.
- Hardens release automation: generated release notes, post-release changelog sync, README/changelog data updates, and package-manager fan-out from the final GitHub release.

## AI assistant

- Added provider implementations for OpenAI and Anthropic.
- Expanded Gemini and Groq support so they share the same provider abstraction as the rest of the assistant.
- Added Ollama chat/model support plus local installer, download, path, and runtime commands.
- Added encrypted AI key storage and a migration-backed usage history store.
- Added provider status, model selection, model pull UI, and usage sections in the assistant/settings surface.
- Improved streaming behavior, message rendering, code block display, and mock assistant data for the web demo.
- Tuned Groq sampling temperature per task type.
- Improved assistant prompts with live index metadata and clearer schema/context instructions.

## Studio and desktop app

- Moved the reusable Studio experience into `packages/studio` so desktop and marketing can share the same core UI.
- Added startup boot-screen handling to avoid the blank desktop launch flash.
- Added query cancellation, schema refresh plumbing, and stricter desktop CSP behavior.
- Improved connection switching, provider detection from pasted URLs, and studio error toasts.
- Preserved high-precision numeric values and BIGINTs during cell editing.
- Fixed typed Postgres/SQLite cell edit and add-record binding behavior.
- Improved data-grid keyboard behavior, single-key row commands, escape handling, focus rings, and tab traversal.
- Added credential-storage notices and install actions shared across desktop and Studio surfaces.

## Marketing and web demo

- Renders Dora Studio at `/app` through the shared `@dora/studio` package.
- Refreshes the landing page with live demos, release-aware download links, GitHub stats, query workflow content, and updated feature cards.
- Adds web-demo guardrails for Tauri-only invokes so the browser demo stays usable outside the desktop shell.
- Improves app-demo framing, theme/color polish, OG/deploy metadata, footer spacing, and Vercel deployment shape.

## Release and distribution

- Bumps the release line to `0.27.0` across root package, desktop package, Tauri config, Cargo manifest, and Cargo lockfile.
- Uses `release.yml` as the single release orchestrator: platform builds upload artifacts, the publish job creates the immutable GitHub release once, then package-manager workflows run from the finished tag.
- Adds GitHub-generated release note grouping and post-release changelog synchronization.
- Consolidates distribution docs into the release guide.
- Adds a Flathub reminder before desktop builds so separate Flathub submission work is not missed.

## Expected assets

- Linux: `.deb`, `.rpm`, `.AppImage`, tarball, and checksums.
- Windows: `.msi`, `.exe`, and checksums.
- macOS: Apple Silicon `.dmg` and Intel `.dmg`.
- Flatpak bundle from the follow-up package workflow.

<!-- Release notes generated using configuration in .github/release.yml at v0.27.0 -->


### Other Changes
- feat(marketing): server-render GitHub stats (ISR)
- refactor(marketing): split features-section into per-card files
- feat(studio): shared @dora/studio package — desktop + marketing /app web demo
- feat: multi-provider AI (OpenAI, Anthropic, Ollama)
- Pre-release: landing fixes, studio polish, and beta prep

# Changelog

All notable changes to this project will be documented in this file.
## [v0.26.5]


### Bug Fixes

- improve connection UX and Groq chat mode handling


### CI/CD

- extend asset poll budget for packaging workflows to 30 minutes


### Chores

- v0.26.5


### Other

- Dora follow-up stability and UI fixes


### Refactoring

- redesign connection switcher with inline delete, settings panel, and sidebar polish

## [v0.26.4]


### Bug Fixes

- bump version files in package/tauri/cargo before tagging


### Chores

- automate package publishing

- add generate:releasetext script

- use git-cliff for release text generation

- add release script that auto-bumps, tags, and generates release text

- v0.26.3

- release script now auto-pushes and creates GitHub release

- v0.26.3

- fix release script to push tag separately

- v0.26.4


### Features

- show all by default, move logs/terminal to bottom panel, pass tail param through

- show all by default, move logs/terminal to bottom panel… (#71)

- structured SQL responses, dry run, syntax highlighting (#72)

## [v0.26.2]


### Bug Fixes

- extract linux tarball binary from tauri-built .deb


### Chores

- v0.26.2

## [v0.26.1]


### Chores

- v0.26.1

## [v0.26.0]


### Bug Fixes

- cast UPDATE value to column type during cell edits

- preserve JSON shape when editing object cells


### CI/CD

- add one-shot tag-create workflow


### Chores

- update dora to 0.25.0

- fix source URL to use v0.25.1 release tag

- update dora to 0.25.1

- regenerate Tauri bindings

- prune stale apps/db-tester entries from bun.lock

- v0.26.0


### Features

- pooler-compatible simple-query mode and pooler detection

- pooler-compatible mode toggle in connection form

- structured SQL responses, dry run, syntax highlighting, mock backend

- dedicated settings workspace replacing popover


### Performance

- backfill exact row counts when planner estimate is zero

## [v0.25.2]


### Bug Fixes

- install pinned bun archive path

- pin compatible bun archive

- use compatible bun for install

- tolerate immutable release uploads


### CI/CD

- publish package manager artifacts safely

## [v0.25.1]


### Bug Fixes

- rewrite store with useReducer to fix concurrent-mode state update bug

- remove nested button, use div+sibling-buttons for tab pills

- add skip-first-row and stop-on-error toggles to import dialog

- guard empty import, clear file input on close, memoize nonPKColumns

- FK schema-qualified navigation, CSV file size guard

- use --user flag for flatpak remote-add and install on GitHub Actions


### CI/CD

- add Flatpak publish workflow


### Chores

- update dora to 0.2.0

- bump version to 0.25.0, add changelog entry


### Documentation

- add v0.25 PRD — tabs, FK drill-down, CSV import

- add v0.25 implementation plan (9 tasks, tabs + FK + CSV)

- add v0.25.0 changelog entry to CHANGELOG.md and fix commit ref in sidebar data


### Features

- chat-style AI assistant sidebar (#63)

- add tab context store with 12-tab cap

- add TabBar component with close and middle-click support

- wire TabsProvider, TabBar, and openTab into Index.tsx

- plumb FK metadata into ColumnDefinition and enrich columns in DatabaseStudio

- add FK drill-down icon, opens referenced table in new tab

- add RFC 4180 CSV parser and column mapping utilities

- add CSV import dialog with preview, column mapping, and progress

- Dora v0.25.0 — Multi-Table Tabs, FK Drill-Down & CSV Import

## [v0.2.2]


### Bug Fixes

- use analytics ingestion endpoint

- use custom analytics ingestion domain

- align database studio headers


### CI/CD

- allow manual dispatch for a specific release tag


### Features

- centralize analytics providers

- add native dora AUR packaging and v0.2.0 updates (#62)


### Other

- detect pgbouncer=true flag and plumb use_simple_query

## [v0.0.117]


### Bug Fixes

- git-cliff config and workflow to generate proper release notes

## [v0.0.116]


### Features

- auto-generate release notes with git-cliff

## [v0.0.113]


### Features

- update desktop app and add Homebrew Cask integration

## [v0.0.112]


### Testing

- update desktop tests for schema visualizer release

## [v0.0.111]


### Chores

- release v0.0.111


### Features

- addd schema visualizer

- addd schema visualizer (#61)


### Refactoring

- apply consistent rustfmt styling across codebase and add row virtualizer for data grid components

## [v0.0.110]


### Bug Fixes

- disable transparent windows to prevent WebKit/Wayland crash


### Documentation

- add schema visualizer + AI SQL to README, bump download links to 0.0.109


### Features

- animated edges, theme-aware colors, search autocomplete

- chained schema-aware autocomplete

- multi-tab console and async row count

## [v0.0.109]


### Bug Fixes

- resolve .deb URL from release assets instead of constructing from tag version

- resolve CI lint, snap, AUR and winget failures

- escape ${srcdir}/${pkgdir} in PKGBUILD template literal

- use type instead of interface in analytics-dispatcher


### Chores

- add GPG public key for apt repo signing

- cleanup lib.rs debug guard and bindings.ts docstring noise


### Documentation

- add backend refactor checklist for remaining phases (5b, 5c, 4, 8)

- add product roadmap with tiered features and frontend checklist

- add keyboard shortcut UI spec using @remcostoeten/use-shortcut


### Features

- keyboard shortcut coverage (#52)

- query history improvements (#57)

- interactive ER diagram view (#58)

- schema-grounded AI ⌘I with Groq rotating-key provider (#59)

- AI encrypted key store + data-grid refactor (0.0.109) (#60)


### Refactoring

- split commands.rs by domain (phase 1) (#47)

- split storage.rs + typed Error enum (phases 2-3) (#48)

- scaffold WriteAdapter trait (phase 5a) (#49)

- add tracing + spans (phase 6) (#50)

- kill production unwraps, add clippy enforcement (phase 7) (#51)

- port mutation logic into WriteAdapter impls (#53)

- wire new error shape and type safety (phase 8)

- ConnectionRepository trait on AppState (phase 4)

- ConnectionRepository trait on AppState (phase 4) (#55)

- wire new error shape and type safety (phase 8) (#56)

- WatchAdapter trait per driver (phase 5c)

- WatchAdapter trait per driver (phase 5c) (#54)

## [v0.0.107]


### Bug Fixes

- add missing analytics-dispatcher, remove stale live-monitor test


### Features

- self-hosted apt repository — sudo apt install dora

## [v0.0.106]


### Features

- v0.0.106 — global live monitor, SSH tunnels, file exports, AUR binary

## [v0.0.104]


### Bug Fixes

- harden winget release workflow

- stabilize rust tests and snap release upload


### Documentation

- sync embedded homebrew tap


### Features

- allow record editing

## [v0.0.103]


### Bug Fixes

- react err

- run snap workflow in destructive mode

- adopt snap metadata from build part

- skip release upload on manual snap publish


### Chores

- update snap workflow, README, and snapcraft for MySQL support

- update snap workflow, README, and snapcraft for MySQL support (#46)

- opt snap workflow into node 24 actions


### Features

- Add MySQL connectivity support and testing companion prompt

- Add MySQL connectivity support (#43)

- add mysql connectivity  (#44)

- mysql connectivity and add homebrew install (#45)


### Other

- cut v0.0.103

## [v0.0.102]


### Bug Fixes

- run snapcraft with sudo in CI

- use bun run in snap build scriptlet

- build snap binary with cargo release


### Other

- prepare v0.0.102

## [v0.0.101]


### Documentation

- add homebrew installation section


### Features

- add homebrew tap for dora


### Other

- prepare v0.0.101

## [v0.1.0]


### Bug Fixes

- change build target to esnext to resolve CI esbuild transform error

## [v0.0.100]


### Bug Fixes

- use valid GitHub Actions commit SHAs

- use stable branch for rust-toolchain to avoid parsing issues


### Chores

- pin GitHub Actions to specific commit SHAs

## [v0.0.98]


### Chores

- checkpoint current workspace before live monitor refactor

- remove bloat

- add all uncommitted changes

- release v0.0.98


### Documentation

- add animated WEBP showcase to README


### Features

- add live database updates


### Refactoring

- replace frontend live polling with backend live monitor manager

## [v0.0.97]


### Other

- UX polish, shortcuts & cleanup

- cut v0.0.97 with type-safety fixes and docker updates

## [v0.0.96]


### Features

- mouse-promo recorder and accessibillity

- finalize Windows Tauri dev and CLI automation

- merge Windows Tauri dev, libsql-rusqlite, and CLI automation

## [v0.0.95]


### Bug Fixes

- repair changelog popover render and restore scroll

- use supported intel macOS runner


### Chores

- prepare v0.0.95 and refresh changelog metadata


### Features

- add rpm msi and intel macOS build target

## [v0.0.94]


### Bug Fixes

- resolve failing tests and rust compile issues

- unblock rust tests in github actions

- add postgres initdb bin path for pgtemp tests

- resolve pipeline failures (#32)

- restore cross-platform release flow and prep v0.0.94 (#33)

- use vcpkg sqlite on windows and avoid sqlite symbol clashes

- export vcpkg sqlite library paths for windows linker


### Documentation

- update README with v0.0.93 download links and installation instructions

## [v0.0.93]


### Bug Fixes

- docker view sort error and save accumulated work

- resolve syntax error in database-studio.tsx

- replace native dialogs with shadcn components and clean up debug logs

- pass prebuild checks and fix production build

- correct rust-toolchain action reference and package.json syntax


### Chores

- cleanup unused files and dependencies (audit)

- optimize insert_row allocation (backend round 2)

- snapshot before full system audit

- prepare v0.0.93 with comprehensive changelog


### Features

- add cleanup audit tools

- performance optimizations (bundle split, zero-flash pagination, efficient IPC)

- Add Monaco Editor workers and LSP utilities to enhance code editing features.

- replace native alerts with shadcn and align bottom bars

- error handling, query history, and release-ready UI polish

- add custom shortcuts UI with persistence and dynamic bindings

- Add light/dark theme toggle, SQL snippet saving, and refactor connection snippet display.

- add typo detection with fuzzy matching

- add Drizzle-aware typo diagnostics with fuzzy suggestions

- integrate Drizzle-aware typo diagnostics across UI components


### Performance

- efficient IPC layer, bundle split, monaco workers offload (#28)

## [v0.0.925]


### Bug Fixes

- improve sidebar dragging physics and animations

- sidebar resize now follows mouse in real-time instead of snapping

- propagate connection errors in test_connection

- Strip unsupported channel_binding parameter from PostgreSQL connection strings

- resolve table data loading and sort crash

- address CodeRabbit PR review comments

- lsp build issues


### CI/CD

- upgrade runners to Blacksmith for 2x faster performance

- revert to standard ubuntu-latest runners


### Chores

- cleanup dead/duplicate code files

- restructure frontend core

- save pending changes

- finalize resize and cleanup docs

- cleanup project structure (remove unused FE, rename docs, move test queries)

- misc fixes and improvements across desktop and api-docs

- prepare for release v0.0.9 - code style cleanup and fixes

- remove redundant api-docs project and move docs to root

- prepare release 0.0.92

- 0.0.92

- bump version to 0.0.925


### Documentation

- update readme with beta feature status

- refine readme features and roadmap


### Features

- add auto-fill, typo detection & validation for connection strings

- add autocomplete input with keyboard navigation

- refresh splash screen design

- add database-backed settings with theme persistence

- add sql-builder, resize-handle, UI improvements and border fixes

- add sql-builder, autocomplete and settings persistance (#1)

- implement accessible Label component and replace native labels

- implement AES-GCM encryption for connection storage

- implement get_connection method

- add context menu to saved connections

- add connection history tracking with filters

- enhance connections UI and data table UX with favorites, timestamps, sorting, pagination

- Implement command palette with global command system and persistent keyboard shortcuts.

- enhance connection string parsing, improve shortcut management, and refine UI interactions

- add command palette UI and refactor URL query string construction.

- Implement command usage tracking and persistence, add new application commands, and enhance command palette sorting based on usage history.

- Implement command palette with global command system  (#4)

- add spreadsheet-like Table Browser with filtering, sorting, inline editing, and dry-run mode

- Implement dedicated table exploration view with a new `table-view` tab type and `TableBrowser` component.

- Implement schema visualization with React Flow and add back navigation to table browser.

- Implement core application structure, introduce shared UI components, and integrate Tauri commands for database management.

- Introduce unified header and logo components, refactor theme colors to hex/rgba, and add keyboard shortcuts for main view navigation.

- Introduce unified header and logo components, refactor theme co… (#6)

- Add Monaco Editor and Switchable SQL Editor components

- add database adapter trait, mutation API, and enhanced schema introspection

- add LibSQL database support for local and remote Turso connections

- add LibSQL database parsing and execution support

- Reorganize project structure and migrate existing components to a new `_old` directory layout.

- major backend upgrade

- update docs dependencies, add new desktop icons, and remove old Tauri database files.

- integrate AI service types with Specta

- expose and finalize SSH tunnel module

- implement Specta integration and generate TypeScript client

- add duplicate_row command for context menu actions

- implement snippet library with pre-made and user-created snippets

- introduce snippet categories for improved organization and filtering

- Backend API V2 & Specta Integration (#8)

- run queries via rust

- implement data provider pattern and refactor sidebar

- implement better web mock view

- implement data provider pattern for web mock view (#10)

- improve accessibillity for data viewer

- implement rust binding in FE

- implement missing desktop features

- add user theme and setting persistance

- add user theme and setting persistence (#11)

- implement SSH tunnel configuration for database connections

- SSH Tunnel configuration for database connections (#12)

- Schema Management (DDL) feature (#13)

- centralization keyboard shortcuts (#14)

- Undo/redo functionality, editor themes,  DDL retrieval & dry mode (#15)

- implement changelog panel and cell improvements

- release version 0.0.9 by updating tauri config, adding release notes, and updating the README.

- Implement bulk edit and set null functionalities, and refactor … (#16)

- Redesign and reposition the DemoBanner as a fixed, floating component in the bottom-right corner.

- add Midnight, Forest, Claude Light, and Claude Dark themes with… (#19)

- Add new technical and vintage font options, remove density setting, and update Vercel deployment configurations.

- custom drizzle DSL LSP for monaco covering 100% of spec

- implement comprehensive test infrastructure\n\n- Add test scripts to package.json files\n- Configure Turbo build to depend on tests\n- Create GitHub Actions CI workflow with Postgres service\n- Migrate Rust tests to proper integration tests structure\n- Export Rust modules for testing access

- implement testing infrastructure

- implement testing suite and floating selecton bar  (#20)

- sync monaco theme with ui switcher (#21)

- typo detection algorithm and testing infrastructure (#22)

- implement branding & LSP promotion helpers (#23)

- Implement theme synchronization, URL state management, and enhance data grid context menu handling. (#24)

- implement promotional LSP demo mode

- Introduce recording mode with configurable UI elements, environment variable support, and a visual overlay.

- update app logo, favicon, and sidebar branding

- Implement theme synchronization, URL state management, and enhance data grid context menu handling.

- Enhance table info dialog with PostgreSQL validation and SQL escaping, synchronize data grid focused cell, and simplify cell context menu API.

- Distinguish context menu kind in URL state, truncate large selected cell sets, and validate URL-derived table states against current table dimensions.

- introduce new application sidebar and integrate it with the database studio, including an animated toggle icon.

- implement docker container manager mvp (#25)

- enhance Docker container management with advanced creation options, connection snippets, compose export, and database seeding (#26)

- add Tauri dialog plugin and Zustand, and ignore local environment files in gitignore

- release 0.0.925 - docker manager, data seeder, build fixes


### Other

- restore security and label features while keeping sidebar animations

- implement domain architecture (#5)


### Refactoring

- reorganize components and enhance tabs with context menu, dnd, and pin support

- rename component-specific type aliases to Props and remove associated refactoring scripts.

- update metadata structs, fix parser compatibility, and resolve types

- Simplify web demo auto-connection logic to generically auto-select the first table.


### Testing

- add comprehensive encryption tests

<!-- generated by git-cliff -->

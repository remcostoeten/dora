# Changelog

## 0.0.110 - Multi-Tab Query Console & Async Row Count

**Date:** 2026-04-27

**Highlights**

- **Multi-Tab Query Console**: The SQL Console now supports multiple active query tabs. Each tab acts as an independent workspace with its own editor content, results, execution state, and scroll position. Includes drag-to-reorder, tab persistence, auto-titling from queries, and premium tab bar UX (keyboard shortcuts: `Ctrl+T`, `Ctrl+W`, `Alt+1-9`).
- **Async Row Count in Status Bar**: The results panel now fires an asynchronous `SELECT COUNT(*)` query in the background to show the true total row count in the status bar. Includes a non-blocking shimmer loading animation and a 30-second cache that auto-invalidates on schema mutations.

## 0.0.109 - Data Grid Refactor & Schema Visualizer Fix

**Date:** 2026-04-25

**Highlights**

- Split the 1455-line `data-grid.tsx` into a 245-line shell plus 15 focused modules under `data-grid/` — extracted hooks (`use-cell-editing`, `use-cell-selection`, `use-row-selection`, `use-grid-keyboard`, `use-column-resize`, `use-context-menu-reporting`, `use-focused-cell`, `use-right-drag-scroll`), child components (`cell-value`, `draft-row`, `empty-states`, `grid-body`, `grid-header`), and pure modules (`selection.ts`, `types.ts`). Same behavior, far cleaner ownership.
- Restored the broken imports in `schema-visualizer/components/table-node.tsx` (Handle, Position, NodeProps, Key, LinkIcon) — `tsc -b` is now clean.
- Bundles every change shipped on this branch: AI encrypted key store (Settings → AI Keys), abort path for the ⌘I overlay, JSON-mode streaming, key rotation on 5xx/403, and Insert + Run.

## 0.0.108 - AI SQL Generator: Encrypted Key Store, Test, Abort & Insert+Run

**Date:** 2026-04-24

**Highlights**

- Added an encrypted Groq API key store inside the app — Settings → AI Keys (Groq) lets you add, label, enable/disable, test, and delete keys. Ciphertext is AES-256-GCM and the master key lives in the OS keychain (Keychain / libsecret / Credential Manager).
- Env-based keys (`GROQ_API_KEY`, `GROQ_API_KEY_1..10`, `GROQ_MODEL`) are still honored and merged with UI-stored keys at runtime, with duplicate keys deduplicated.
- New "Test" button validates a key against Groq before saving, and a per-key live test button records the result in the row.
- The ⌘I overlay now shows a status badge (`N keys` / `no keys`) so missing configuration is obvious before you type a prompt.
- New "Insert + Run" action — accepting an AI suggestion with ⌘⏎ pastes the SQL into the editor and immediately executes it.
- Added a real abort path — closing the overlay or hitting Esc mid-stream calls `ai_abort_stream` and the backend short-circuits the SSE loop.
- Streaming completions now request `response_format: json_object`, which keeps tokens inside a JSON envelope and stops the model wandering into prose / markdown fences mid-stream.
- Key rotation now also fires on `5xx` and `403` errors (was 429/401 only) so transient provider issues fail over instead of bubbling up.
- Bumped reqwest client to a 60s timeout for streaming and a separate 15s client for key tests.

## 0.0.107 - Self-hosted APT Repository (sudo apt install dora)

**Date:** 2026-04-19

**Highlights**

- Added a self-hosted apt repository published via GitHub Pages — Debian/Ubuntu users can now `sudo apt install dora` after a one-time source setup.
- CI workflow auto-generates `Packages`, `Packages.gz`, and a signed `Release` file on every GitHub release and deploys to GitHub Pages.
- GPG signing supported via `GPG_PRIVATE_KEY` repository secret; falls back to unsigned (trusted) if not configured.
- Added `release:apt` script for local generation.
- Updated README install instructions to feature the apt repo as the recommended Linux install path.

## 0.0.106 - Live Monitor Global, SSH Tunnels, File Exports & AUR Binary Package

**Date:** 2026-04-19

**Highlights**

- Made the live database monitor a global React context (`LiveMonitorProvider`) so external DB changes trigger notifications and data refresh app-wide, not just per active table.
- Fixed SSH tunnel configuration not being passed to the backend — SSH tunnels now work correctly when adding or updating connections.
- Fixed row exports (JSON/SQL) to generate real file downloads instead of copying to clipboard.
- Fixed schema sidebar and SQL console revalidation after mutations like DROP TABLE, ADD COLUMN, and SQL execution.
- Removed the recording overlay feature.
- Switched AUR package from source-build (10+ min compile) to a pre-built AppImage binary package — `yay -S dora` or `sudo pacman -S dora` now installs in seconds.

## 0.0.102 - Snap Workflow Follow-up & Packaging Release Cleanup

**Date:** 2026-04-05

**Highlights**

- Fixed the Snap CI workflow so packaging builds run correctly on GitHub Actions.
- Switched the Snap build path to a direct Rust release build instead of an invalid Tauri bundle flag.
- Carries the packaging automation and VM lab work forward into a clean tag that matches branch head.

## 0.0.101 - Packaging Automation, VM Lab & Desktop Iteration

**Date:** 2026-04-05

**Highlights**

- Added repo-native packaging helpers for Winget, AUR, Snap, release checksums, and release guidance.
- Added an Ubuntu host VM lab flow for provisioning Ubuntu, Arch, and Windows packaging test environments.
- Updated the in-app changelog and release surfaces for the new release milestone.
- Bundled the current desktop, docs, test, and workflow iteration work into the `0.0.101` line.

## 0.1.0 - Project Foundation & Documentation Audit

**Date:** 2026-04-04

**Highlights**

- Established 0.1.0 version baseline across the monorepo.
- Completed full Homebrew installation documentation and README overhaul.
- Verified 115/115 tests passing for the new milestone.

## 0.0.99 - Homebrew Support & CI Security Hardening

**Date:** 2026-04-04

**Highlights**

- Added the official Homebrew Tap at `remcostoeten/homebrew-dora` (`brew install dora`).
- Pinned all GitHub Actions to specific commit SHAs for improved supply chain security.
- Optimized the esbuild target to `esnext` to resolve CI transform errors.
- Stabilized the Rust toolchain reference in automated workflows.

## 0.0.98 - Live Database Updates & Performance Refactor

**Date:** 2026-04-04

**Highlights**

- Implemented a backend-driven live database monitor manager.
- Eliminated inefficient frontend polling logic for faster performance.
- Added support for real-time data grid updates on external database changes.
- Enhanced documentation with an animated showcase of live performance.

## 0.0.97 - Type Safety Recovery, Feature-State Alignment & Docker Manager Updates

**Date:** 2026-02-20

**Highlights**

- Restored strict TypeScript build health for the desktop app (`tsc --noEmit` now passes).
- Fixed adapter/result typing drift and related runtime-safe error handling paths.
- Aligned sidebar feature state: Docker Manager remains active while only unavailable items are marked "Coming soon".
- Added/updated Docker manager feature work (terminal flow + UX/API refinements).
- Updated README/docs to reflect actual current feature status and audit baseline.

## 0.0.95 - Packaging Expansion & Changelog Stability

**Date:** 2026-02-09

**Highlights**

- Added Linux `.rpm` and Windows `.msi` bundle targets.
- Added Intel macOS release job (`macos-13`) in addition to Apple Silicon flow.
- Fixed changelog popover crash in web view caused by invalid JSX/object rendering.
- Restored reliable scrolling/navigation through older changelog entries.
- Added unseen-changes indicator badge on the changelog trigger in the sidebar.

## 0.0.94 - CI/Release Infrastructure Recovery

**Date:** 2026-02-09

**What happened between `v0.0.93` (`d596a4c`) and `master` (`df1d696`)**

- `4ded3ed`: Updated README for `v0.0.93` release links and install docs.
- `73fafbc`: Fixed CI failures in tests and Rust compile flow.
- `6654232`: Unblocked Rust tests in GitHub Actions.
- `20e0161`: Added PostgreSQL `initdb` path setup for `pgtemp` in CI.
- `df1d696`: Final pipeline stabilization merged via PR #32.

**Release pipeline fixes in `v0.0.94`**

- Linux release runner moved to `ubuntu-latest` and updated Tauri v2 system dependencies (`webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`).
- macOS release job now builds unsigned artifacts in CI by removing failing Apple signing environment wiring.
- Windows packaging now links SQLite reliably by enabling `rusqlite` `bundled` feature to avoid missing `sqlite3.lib`.
- Version metadata aligned to `0.0.94` for npm + Tauri config + in-app changelog.

## 0.0.92 - Docker Manager & UI Overhaul

**Features**

- **Docker Manager MVP**: Manage containers, view logs, and export docker-compose configurations directly from the app.
- **New Sidebar**: A completely redesigned, collapsible sidebar with animated navigation for better space efficiency.
- **URL State Management**: Deep linking support for selected rows, cells, and active tables.
- **Theme Synchronization**: Improved theme consistency across the application and sub-windows.
- **Context Sensitive URLs**: URL parameters now reflect the specific context of the data grid selection.

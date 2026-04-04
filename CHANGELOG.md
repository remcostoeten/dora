# Changelog

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

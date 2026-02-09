# Changelog

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

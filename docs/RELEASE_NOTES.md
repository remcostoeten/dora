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

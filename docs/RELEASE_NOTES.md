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

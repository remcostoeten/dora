# Release Notes - v0.0.97

**Date:** 2026-02-20
**Tag:** `v0.0.97`
**Range:** `v0.0.96..master`

## Summary

This release focuses on release-readiness and UX consistency: TypeScript strictness is restored, sidebar feature states are aligned with actual behavior, and Docker manager improvements continue.

## Changes since `v0.0.96`

- Fixed strict TypeScript errors across frontend modules and shared adapters.
- Added safer adapter error handling with proper union narrowing.
- Updated Monaco/drizzle editor typing and completion plumbing.
- Moved Docker Manager out of the "coming soon" bucket into active navigation.
- Kept only truly unavailable items marked as "Coming soon".
- Updated docs (README/feature matrix/audit notes) to match implementation.
- Included ongoing Docker manager enhancements in UI/components/APIs.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg` (Apple Silicon + Intel)
- Windows: `.exe`, `.msi`

# Release Notes - v0.0.95

**Date:** 2026-02-09
**Tag:** `v0.0.95`
**Range:** `v0.0.94..master`

## Summary

This release expands installer coverage and fixes changelog UX regressions in the sidebar popover.

## Changes since `v0.0.94`

- Added Linux RPM bundle target.
- Added Windows MSI bundle target.
- Added Intel macOS release build job.
- Fixed changelog popover React crash in web view.
- Restored changelog popover scroll behavior for older entries.
- Added unseen changelog indicator on the bottom toolbar trigger.

## Expected assets

- Linux: `.deb`, `.AppImage`, `.rpm`
- macOS: `.dmg` (Apple Silicon + Intel)
- Windows: `.exe`, `.msi`

# Release Notes - v0.0.94

**Date:** 2026-02-09
**Tag:** `v0.0.94`
**Range:** `v0.0.93..master` (`d596a4c..df1d696`)

## Summary

This release focuses on CI and release pipeline reliability so all platform artifacts are generated again.

## Changes since `v0.0.93`

- Stabilized Rust test execution in CI.
- Added `pgtemp` PostgreSQL `initdb` PATH wiring for GitHub runners.
- Updated Linux release dependencies for Tauri v2.
- Fixed Windows release linking by enabling bundled SQLite in `rusqlite`.
- Adjusted macOS release configuration to avoid signing-env failure for unsigned CI builds.

## Expected assets

- Linux: `.deb`, `.AppImage`
- macOS: `.dmg`
- Windows: `.exe`

# Release Notes - v0.0.9

**Date:** 2026-01-15
**Commit:** `de9940f`

## SSH Tunneling, Dora CLI & Bulk (dry mode) editing

This major update brings essential connectivity features, safe editing modes, and a complete CLI ecosystem.

### Key Highlights

#### SSH Tunneling & Connectivity

- **Secure Remote Access**: Connect to production databases securely via SSH tunneling.
- **Connection Manager**: Save, pin, and organize your database connections.

#### Safe Editing & Bulk Operations

- **Dry Run Mode**: Test schema operations and queries safely before applying changes.
- **Bulk Editing**: Drag-select multiple cells/rows for mass updates.
- **Undo/Redo**: Local mutation history stack for worry-free data manipulation.
- **Soft Delete**: Mark rows for deletion without immediate removal.

#### The New Dora CLI

- **Central Hub**: New `dora` binary to manage builds, releases, and database ops.
- **Native Installers**: Generate and manage `.deb` packages directly from the CLI.
- **Self-Update**: Rebuild the runner itself with a single command.

### Other Improvements

- **Editor Themes**: SQL editor now matches your selected application theme.
- **Performance**: Optimized data grid rendering and build size (~8.5MB).
- **Cleanup**: Removed marketing fluff and emojis from documentation.
- **Builds**: Automatic `.deb` generation for Debian/Ubuntu.

### Assets

- `dora_0.0.9_amd64.deb`

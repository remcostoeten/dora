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

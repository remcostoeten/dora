# Release Notes - v0.0.91

**Date:** 2026-01-15
**Commit:** `de9940f` + uncommitted changes

## Highlights

Migration to Rolldown for significantly faster builds, along with cleanup and build optimization changes.

### Changes
- **Build System**: Migrated from Rollup/Vite default to **Rolldown** (via `rolldown-vite`).
- **Configuration**: Updated `package.json` to explicitly alias `vite` to `rolldown-vite`.
- **Build Config**: Added filter to exclude api-docs from build process in turbo.json.
- **Documentation**: Removed emojis from README.md and RELEASE_NOTES.md for cleaner formatting.
- **Cleanup**: Removed icon.icns, specs/DATA_SEEDING.md files, and `overrides` configuration in favor of direct dependency management.
- **Dependencies**: Updated bun.lock with dependency changes.

---

# Release Notes - v0.0.9

**Date:** 2026-01-15
**Commit:** `30747e35` (approx)

## Highlights

This release focuses on improving the editing experience, theming, and ensuring a robust release pipeline.

### New Features
- **Changelog Panel**: A new "What's New" section in the sidebar to track updates.
- **Undo/Redo Support**: Safer editing with undo/redo capabilities in the data grid.
- **Editor Themes**: Integrated themes for the SQL editor matching the application theme.
- **DDL & Dry Run Mode**: Support for Schema operations and safe query testing.

### Improvements
- **Code Style**: Enforced consistent code style (ESLint/Prettier) and removed arrow functions in key components.
- **Performance**: Optimized data grid rendering and cell interactions.
- **Builds**: Automated generation of Linux executables (AppImage, Deb, RPM).

## Downloads

The following executables have been generated:

### Linux
- **AppImage**: `apps/desktop/src-tauri/target/release/bundle/appimage/Dora_0.0.9_amd64.AppImage`
- **Debian/Ubuntu**: `apps/desktop/src-tauri/target/release/bundle/deb/Dora_0.0.9_amd64.deb`
- **Fedora/RHEL**: `apps/desktop/src-tauri/target/release/bundle/rpm/Dora-0.0.9-1.x86_64.rpm`

---

*Verified by Antigravity Agent*

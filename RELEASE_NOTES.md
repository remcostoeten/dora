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


<div align="center">
  <img src="dora-backgroundless.png" alt="Dora Logo" width="200" />
  <h1>Dora</h1>
  <p><i>Database studio built with Tauri + React</i></p>

[![Rust](https://img.shields.io/badge/Rust-black?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?logo=tauri&logoColor=black)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-lightgrey)](https://github.com/remcostoeten/dora)

</div>

Dora is a cross-platform database studio focused on fast local UX, keyboard-first workflows, and a native desktop footprint.

## Supported Databases

- PostgreSQL
- SQLite
- LibSQL / Turso

`MySQL` and first-class `SSH tunnel` UI are scaffolded but still marked as coming soon in the current frontend.

## Audit Snapshot (2026-02-20)

- `bun run test:desktop`: `115/115` tests passing.
- `bun run --cwd apps/desktop build`: production build succeeds.
- `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`: passes (warnings only).
- `bun x tsc --noEmit -p apps/desktop/tsconfig.app.json`: fails with multiple TypeScript errors.

Full findings: `docs/app-audit-2026-02-20.md`.

## Feature Matrix

| Area | Feature | Status | Notes |
| :-- | :-- | :--: | :-- |
| Connectivity | Saved connections (create/update/delete) | Done | Includes connection testing and persistence. |
| Connectivity | PostgreSQL + SQLite + LibSQL | Done | Core adapters and UI are wired. |
| Connectivity | MySQL | Soon | Selector exists but disabled in UI. |
| Connectivity | SSH Tunnel UI | Soon | Backend supports fields; frontend currently disabled. |
| Data Studio | Table browser + pagination + sorting + filters | Done | Includes content and structure views. |
| Data Studio | Inline edits + add/duplicate/delete rows | Done | Supports per-row and multi-row workflows. |
| Data Studio | Dry edit mode with staged changes | Done | Apply/discard pending edits before writing. |
| Data Studio | Export JSON / CSV / SQL INSERT | Done | Table-wide and selected-row exports. |
| Data Studio | Copy SQL schema / Drizzle schema | Done | Available from the toolbar. |
| Data Studio | Add column / drop table | Done | DDL actions from structure view. |
| Data Studio | Mock data seeding | Done | Faker-based generator + preview dialog. |
| SQL Console | SQL + Drizzle editors | Done | Monaco-based editors with run + format support. |
| SQL Console | Query history and snippet/folder library | Done | Backed by storage commands. |
| SQL Console | Result export (JSON/CSV) | Done | From toolbar/result views. |
| SQL Console | Result filter panel | WIP | UI currently shows “Coming Soon”. |
| Docker Manager | PostgreSQL container lifecycle | Beta | Create/start/stop/restart/remove managed containers. |
| Docker Manager | Logs, details, compose export, terminal | Beta | Available in Docker feature panel. |
| UX | Keyboard shortcuts + URL state + theme/settings sync | Done | Includes state restoration for last connection/table. |
| AI | AI assistant screen in app nav | Soon | Sidebar item is disabled placeholder. |

## Download

Prebuilt desktop artifacts are published in GitHub Releases:

- Linux: `.deb`, `.rpm`, `.AppImage`
- macOS: `.dmg`
- Windows: `.exe`, `.msi`

See: https://github.com/remcostoeten/dora/releases

## Development

### Prerequisites

- Bun
- Rust toolchain (`cargo`, `rustup`)
- Tauri system dependencies for your platform

### Install

```bash
bun install
```

### Run

```bash
# React web shell
bun run web:dev

# Desktop app (Tauri)
bun run desktop:dev
```

### Quality checks

```bash
# Frontend/unit tests
bun run test:desktop

# Frontend typecheck (currently failing in main)
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json

# Rust backend compile check
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

### Build

```bash
# Workspace build
bun run build

# Desktop release build
bun run desktop:build
```

## Workspace Helpers

See `apps/desktop/README.md` for Windows Tauri helper scripts and libsql vendor refresh instructions.

## License

GNU General Public License v3.0. See `LICENSE`.

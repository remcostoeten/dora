<div align="center">
  <img src="assets/dora-backgroundless.png" alt="Dora Logo" width="90" />
  <h1>Dora</h1>
  <p><i>The database explorer</i></p>
  <small><i>A native-feeling desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL.</i></small>

[![Release](https://img.shields.io/github/v/release/remcostoeten/dora?display_name=tag&sort=semver)](https://github.com/remcostoeten/dora/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macos%20%7C%20windows%20%7C%20linux-111827)](https://github.com/remcostoeten/dora/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-tauri-FFC131?logo=tauri&logoColor=ffffff)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/rust-000000?logo=rust&logoColor=ffffff)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)

</div>

<p align="center">
  <img src="assets/demo-tour.webp" alt="Dora App Demonstration" width="92%" />
</p>

<small><em>UI heavily inspired by Drizzle Studio</em></small>

Dora is a cross-platform database studio for PostgreSQL, MySQL, SQLite, and LibSQL.
Built with Tauri, it weighs ~10 MB versus the 100-500 MB of commonly used tools (pgAdmin, TablePlus, Beekeeper Studio) - no
Electron bloat, just a fast native app with a Data Viewer, Monaco SQL/Drizzle
editor, and local Docker PostgreSQL tooling.

## Features

| Category | Features |
|----------|----------|
| **Connect** | • Save, edit, test, search, and switch between connections<br>• PostgreSQL, MySQL, SQLite, LibSQL / Turso<br>• Structured fields or full connection strings<br>• Open SQLite files via native file picker<br>• SSL/TLS and SSH tunneling (PostgreSQL)<br>• Restore last connection on startup |
| **Docker Integration** | • Create, start, stop, restart, inspect, remove containers<br>• Search, filter, sort containers by status<br>• Open container directly in Data Viewer<br>• View logs, open terminal, run seed scripts<br>• Copy connection snippets, export Docker Compose |
| **Data Explorer** | • Browse schemas, tables, columns, indexes, and metadata<br>• Switch between content and structure view<br>• Sort, filter, paginate, show or hide columns<br>• Inspect row details and set values to `NULL`<br>• Inline cell editing, add/duplicate/delete rows<br>• Bulk edit selections<br>• Stage changes in dry-run mode before applying<br>• Export data as JSON, CSV, or SQL `INSERT`<br>• Copy schema as SQL or Drizzle<br>• Add columns, rename/drop/truncate tables<br>• Seed tables with generated data<br>• Live table updates (PostgreSQL: LISTEN/NOTIFY, MySQL: polling, others: polling) |
| **Query Editor** | • Monaco-based SQL and Drizzle editor with autocomplete<br>• Run `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and DDL<br>• Save snippets in folders, reuse per connection<br>• Schema sidebar to browse and insert tables/columns<br>• Query history with search and re-run<br>• Filter result sets, switch between table and JSON view<br>• Export results as JSON or CSV<br>• Edit or delete rows from single-table result sets |
| **Customization** | • Keyboard-first navigation with customizable shortcuts<br>• Vim keybindings in the editor<br>• Dark/light themes and configurable font sizes<br>• Secure credential storage via system keyring<br>• Query history with search and re-run<br>• Multiple result tabs<br>• Export database schema (SQL, Drizzle)<br>• Control delete confirmations, notifications, and startup behavior |

## Platforms

Dora is a Tauri app built for macOS, Windows, and Linux.

## Get Dora

### Available Downloads

| Platform | Formats |
|----------|---------|
| **macOS** | [.dmg](https://github.com/remcostoeten/dora/releases/latest) |
| **Windows** | [.exe](https://github.com/remcostoeten/dora/releases/latest) • [.msi](https://github.com/remcostoeten/dora/releases/latest) |
| **Linux** | [.deb](https://github.com/remcostoeten/dora/releases/latest) • [.rpm](https://github.com/remcostoeten/dora/releases/latest) • [.AppImage](https://github.com/remcostoeten/dora/releases/latest) |

### Package Managers

**macOS** (Homebrew):

```bash
brew install --cask remcostoeten/dora/dora
```

**Windows** (Winget):

```bash
winget install remcostoeten.dora
```

## Database Support

These are the database paths the app currently treats as shipped product
surface.

| Database       |   Status    | Notes                                                                          |
| :------------- | :---------: | :----------------------------------------------------------------------------- |
| PostgreSQL     |  Supported  | Full desktop path, including SSH tunneling and live external change monitoring |
| SQLite         |  Supported  | Native desktop workflow                                                        |
| LibSQL / Turso |  Supported  | Local and remote flows                                                         |
| MySQL          | Not shipped | Scaffolded in parts of the codebase, not exposed as a supported feature        |

## Development

```bash
bun install
bun run desktop:dev
```

To validate:

```bash
bun run test:desktop          # Desktop tests
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json  # TypeScript
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml  # Rust
```

To build: `bun run desktop:build`

## Repository Notes

- Desktop-specific notes live in [apps/desktop/README.md](apps/desktop/README.md)
- Audit notes live in [docs/app-audit-2026-02-20.md](docs/app-audit-2026-02-20.md)

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).

<div align="center">
  <img src="assets/dora-backgroundless.png" alt="Dora Logo" width="180" />
  <h1>Dora</h1>
  <p><i>The database explorer</i></p>
  <small><i>A native-feeling desktop database studio for PostgreSQL, SQLite, and LibSQL.</i></small>

[![Release](https://img.shields.io/github/v/release/remcostoeten/dora?display_name=tag&sort=semver)](https://github.com/remcostoeten/dora/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-macos%20%7C%20windows%20%7C%20linux-111827)](https://github.com/remcostoeten/dora/releases)

</div>

<p align="center">
  <img src="assets/demo-tour.webp" alt="Dora App Demonstration" width="92%" />
</p>

Dora is a cross-platform database studio for PostgreSQL, SQLite, and LibSQL.
Built with Tauri, it weighs ~10 MB versus the 100+ MB of TablePlus — no
Electron bloat, just a fast native app with a Data Viewer, Monaco SQL/Drizzle
editor, and local Docker PostgreSQL tooling.

## Features

### Connect

- Save, edit, test, search, and switch between connections
- PostgreSQL, SQLite, LibSQL / Turso
- Structured fields or full connection strings
- Open SQLite files via native file picker
- SSL/TLS and SSH tunneling (PostgreSQL)
- Restore last connection on startup

### Local PostgreSQL with Docker

- Create, start, stop, restart, inspect, remove containers
- Search, filter, sort containers by status
- Open container directly in Data Viewer
- View logs, open terminal, run seed scripts
- Copy connection snippets, export Docker Compose

### Explore and edit data

- Browse schemas, tables, columns, indexes, and metadata
- Switch between content and structure view
- Sort, filter, paginate, show or hide columns
- Inspect row details and set values to `NULL`
- Inline cell editing, add/duplicate/delete rows
- Bulk edit selections
- Stage changes in dry-run mode before applying
- Export data as JSON, CSV, or SQL `INSERT`
- Copy schema as SQL or Drizzle
- Add columns, rename/drop/truncate tables
- Seed tables with generated data
- Live table updates (PostgreSQL: LISTEN/NOTIFY, others: polling)

### Write and run queries

- Monaco-based SQL and Drizzle editor with autocomplete
- Run `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and DDL
- Save snippets in folders, reuse per connection
- Schema sidebar to browse and insert tables/columns
- Query history with search and re-run
- Filter result sets, switch between table and JSON view
- Export results as JSON or CSV
- Edit or delete rows from single-table result sets

### Make Dora fit your workflow

- Keyboard-first navigation with customizable shortcuts
- Vim keybindings in the editor
- Dark/light themes and configurable font sizes
- Secure credential storage via system keyring
- Query history with search and re-run
- Multiple result tabs
- Export database schema (SQL, Drizzle)
- Control delete confirmations, notifications, and startup behavior

## Platforms

Dora is a Tauri app built for macOS, Windows, and Linux.

## Get Dora

Download the latest release for your platform:
https://github.com/remcostoeten/dora/releases/latest

### Install

**macOS** (Homebrew):

```bash
brew install remcostoeten/dora/dora
```

**Windows** (Winget):

```bash
winget install remcostoeten.dora
```

**Linux** (.deb, .rpm, .AppImage): Download from the releases page above.

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

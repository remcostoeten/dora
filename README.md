<div align="center">
  <img src="assets/dora-backgroundless.png" alt="Dora Logo" width="180" />
  <h1>Dora</h1>
  <p><i>The database explorer</i></p>
  <small><i>A native-feeling desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL.</i></small>

[![Release](https://img.shields.io/github/v/release/remcostoeten/dora?display_name=tag&sort=semver)](https://github.com/remcostoeten/dora/releases)
[![Downloads](https://img.shields.io/github/downloads/remcostoeten/dora/total)](https://github.com/remcostoeten/dora/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue)](LICENSE)
[![Snap](https://img.shields.io/badge/snap-install-82BEA0?logo=snapcraft&logoColor=ffffff)](https://snapcraft.io/dora)
[![Built with Tauri](https://img.shields.io/badge/built%20with-tauri-FFC131?logo=tauri&logoColor=ffffff)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/rust-000000?logo=rust&logoColor=ffffff)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?logo=typescript&logoColor=ffffff)](https://www.typescriptlang.org/)

</div>

<p align="center">
  <img src="assets/demo-tour.webp" alt="Dora App Demonstration" width="92%" />
</p>

<p align="center"><sub>UI heavily inspired by <a href="https://drizzle.studio">Drizzle Studio</a></sub></p>

Dora is a cross-platform database studio for PostgreSQL, MySQL, SQLite, and LibSQL.
Built with Tauri, it weighs ~10 MB versus the 100+ MB of TablePlus — no
Electron bloat, just a fast native app with a Data Viewer, Monaco SQL/Drizzle
editor, and local Docker PostgreSQL tooling.

## Features

### Connect

- Save, edit, test, search, and switch between connections
- PostgreSQL, MySQL, SQLite, LibSQL / Turso
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
- Live table updates (PostgreSQL: LISTEN/NOTIFY, MySQL: polling, others: polling)

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

- macOS (Apple Silicon): [`.dmg`](https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_aarch64.dmg)
- macOS (Intel): [`.dmg`](https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_x64.dmg)
- Windows: [`.msi`](https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_x64_en-US.msi)
- Linux: [`.deb`](https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_amd64.deb), [`.rpm`](https://github.com/remcostoeten/dora/releases/latest/download/Dora-0.0.103-1.x86_64.rpm), [`.AppImage`](https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_amd64.AppImage)

### Install

```bash
# Linux (Snap)
sudo snap install dora
```

```bash
# Arch Linux (AUR)
yay -S dora
```

```bash
# macOS (Homebrew)
brew install --cask remcostoeten/dora/dora
```

```powershell
# Windows (Winget)
winget install remcostoeten.dora
```

```bash
# Linux (.deb)
wget https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_amd64.deb
sudo apt install ./Dora_0.0.103_amd64.deb
```

```bash
# Linux (.rpm)
wget https://github.com/remcostoeten/dora/releases/latest/download/Dora-0.0.103-1.x86_64.rpm
sudo dnf install ./Dora-0.0.103-1.x86_64.rpm
```

```bash
# Linux (AppImage)
wget https://github.com/remcostoeten/dora/releases/latest/download/Dora_0.0.103_amd64.AppImage
chmod +x Dora_0.0.103_amd64.AppImage
./Dora_0.0.103_amd64.AppImage
```

## Database Support

| Database | Status | Notes |
|----------|--------|-------|
| PostgreSQL | ✅ Supported | Full desktop path, SSH tunneling, live change monitoring via LISTEN/NOTIFY |
| MySQL | ✅ Supported | Connection pooling, schema introspection, live change monitoring via polling |
| SQLite | ✅ Supported | Native desktop workflow with file picker |
| LibSQL / Turso | ✅ Supported | Local and remote flows |

## Development

```bash
bun install
bun run desktop:dev
```

To build: `bun run desktop:build`

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).

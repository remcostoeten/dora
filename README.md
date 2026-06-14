<div align="center">
  <img src="assets/dora-backgroundless.png" alt="Dora" width="120" />
  <h1>Dora</h1>
  <p><em>A native desktop database workbench that stays out of your way.</em></p>

[![Release](https://img.shields.io/github/v/release/remcostoeten/dora?display_name=tag&sort=semver)](https://github.com/remcostoeten/dora/releases)
[![Downloads](https://img.shields.io/github/downloads/remcostoeten/dora/total)](https://github.com/remcostoeten/dora/releases)
[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue)](LICENSE)
[![Snap](https://img.shields.io/badge/snap-install-82BEA0?logo=snapcraft&logoColor=ffffff)](https://snapcraft.io/dora)
[![Built with Tauri](https://img.shields.io/badge/built%20with-tauri-FFC131?logo=tauri&logoColor=ffffff)](https://tauri.app/)

</div>

<p align="center">
  <img src="assets/demo-tour.webp" alt="Dora in use" width="92%" />
</p>

Dora is a cross-platform database workbench built with Tauri and Rust. It connects to PostgreSQL, MySQL, MariaDB, CockroachDB, SQLite, libSQL/Turso, and DuckDB — plus serverless Postgres/MySQL (Neon, Supabase, PlanetScale) via one-click presets — and ships as a ~10 MB binary instead of the 100+ MB you get from Electron-based alternatives.

It covers the full day-to-day loop: browse data, run queries with a Monaco editor, inspect schemas as an ER diagram, manage local Docker databases, generate SQL with AI, and write type-safe Drizzle ORM queries — all from one keyboard-first app.

## Install

**macOS**
```bash
brew install remcostoeten/tap/dora
```

**Windows**
```powershell
winget install RemcoStoeten.Dora
```

**Arch Linux**
```bash
yay -S dora
```

**Debian / Ubuntu**
```bash
curl -fsSL https://remcostoeten.github.io/dora/KEY.gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/dora.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/dora.gpg] \
  https://remcostoeten.github.io/dora stable main" \
  | sudo tee /etc/apt/sources.list.d/dora.list
sudo apt update && sudo apt install dora
```

**Linux (Snap)**
```bash
sudo snap install dora
```

**Linux (Flatpak / AppImage / deb / rpm)** — download from the [releases page](https://github.com/remcostoeten/dora/releases).

## Database support

| Database | Status |
|---|---|
| PostgreSQL | Full support — SSH tunneling, live updates via LISTEN/NOTIFY |
| MySQL | Full support — SSH tunneling, live updates via polling |
| SQLite | Full support — native file picker |
| DuckDB | Beta — local `.duckdb` files (editable), import CSV/JSON/Parquet as tables |
| Data files (CSV / TSV / Parquet / JSON / NDJSON) | Readonly DuckDB-backed sessions — query, export, cross-file JOINs; Save as DuckDB to edit |
| libSQL / Turso | Full support — local and remote |
| MariaDB | Full support — MariaDB-aware dialect detection; native `UUID` / `INET4` / `INET6` types render correctly |
| CockroachDB | Full support — CockroachDB-aware schema introspection; live monitor auto-tuned (no `LISTEN/NOTIFY`) |
| Neon · Supabase | Full support — Postgres-compatible, one-click connection presets |
| PlanetScale | Full support — MySQL-compatible connection preset |

Dora separates the **wire engine** (Postgres, MySQL, …) from the **dialect/vendor** flavor, detecting the dialect at connect time and adapting schema introspection, capabilities, and type rendering per vendor. Serverless and compatible providers ride their base engine with a dedicated preset — adding a new one is metadata, not a fork. See [docs/architecture/data-sources.md](docs/architecture/data-sources.md).

## Local files

Dora distinguishes **database files** from **data files**:

| Open this | What you get |
|---|---|
| `.sqlite` / `.db` | Editable SQLite database |
| `.duckdb` | Editable DuckDB database — browse, edit rows, run SQL, import more files |
| CSV, JSON, Parquet, TSV, NDJSON | **Data files** — readonly DuckDB-backed session. Tables are rebuilt from disk when the connection opens. SQL queries, export, and cross-file JOINs work; inline row editing does not. |

**Making data files editable**

- **Save as DuckDB** — materializes the active data-file session into a new `.duckdb` file on disk, then opens it as an editable connection. The original data-file connection is unchanged.
- **Import files** — on an existing native `.duckdb` connection, import CSV/JSON/Parquet as physical tables you can edit.

**Recovery**

If a data file moves or goes missing, Dora shows connection health (Active / Connected with issues / Unavailable) and lets you relocate or remove sources from the source panel without losing the connection entry.

Open database files via the connection dialog file picker. Open data files via drag-and-drop or **Open data file** in the desktop app.

## Features

**Data viewer** — Browse schemas, tables, columns, indexes, and row data. Sort, filter, paginate, inline-edit cells, bulk-edit selections, set values to `NULL`, add/duplicate/delete rows, and stage changes in dry-run mode before committing. Export as JSON, CSV, or SQL `INSERT`.

**SQL console** — Multi-tab workspace with isolated execution state. Monaco editor with autocomplete, syntax highlighting, and Vim keybindings. Run `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and DDL. Filter result sets, switch between table and JSON view, export results.

**Query history** — Every query you run is stored, searchable, and re-runnable. History is scoped per connection.

**Schema visualizer** — Interactive ER diagram with pan, zoom, FK edges, and a search that dims unrelated tables.

**Docker manager** — Create, start, stop, inspect, and remove local database containers without leaving the app. Open a container directly in the data viewer, view logs, run seed scripts, or export a Docker Compose file.

**AI SQL generation** — Press `⌘I` / `Ctrl+I`, describe what you want, get schema-grounded SQL back. Supports Groq, Ollama, and other providers. API keys are stored encrypted (AES-256-GCM) with the master key in the OS keychain. See [docs/ai-providers.md](docs/ai-providers.md) for per-provider setup and troubleshooting.

**Drizzle runner** — Write and run Drizzle ORM queries with schema-aware autocomplete and a SQL preview before execution.

**SSH tunneling** — Connect to databases behind firewalls through encrypted SSH tunnels. Tunnel config is stored per connection alongside its credentials.

**Theming** — Dark and light themes, custom accent colours, and configurable font sizes. Live preview, no restart required.

## Development

Dora is a Bun + Turborepo monorepo:

```
apps/
  desktop/   # Tauri app (Rust backend + React/TypeScript frontend)
  marketing/ # Next.js marketing site
packages/
  style/     # Shared ESLint + Prettier config
```

**Prerequisites:** [Bun](https://bun.sh), [Rust](https://rustup.rs), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```bash
# Install dependencies
bun install

# Start the desktop app in development mode
bun run desktop:dev

# Run the marketing site
bun run --cwd apps/marketing dev
```

**Build**

```bash
bun run desktop:build                    # current platform
bun run desktop:build:linux              # AppImage + deb + rpm
bun run desktop:build:win                # nsis + msi
bun run desktop:build:mac                # dmg
```

**Tests**

```bash
bun test
```

> [!NOTE]
> The desktop app uses Vite as its dev server (`http://localhost:1420`). Hot-reload works for the TypeScript frontend; Rust changes require a full rebuild.

## Platforms

macOS (Apple Silicon + Intel), Windows (x64), Linux (x64) via AppImage, deb, rpm, Snap, or Flatpak.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).

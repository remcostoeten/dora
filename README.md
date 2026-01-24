<div align="center">
  <img src="dora-backgroundless.png" alt="Dora Logo" width="200" />
  <h1>Dora</h1>
  <p><i>The Database Explorer</i></p>

[![Rust](https://img.shields.io/badge/Rust-black?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?logo=tauri&logoColor=black)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-lightgrey)](https://github.com/remcostoeten/dora)

</div>

**Dora** is a high-performance, keyboard-centric database manager. Built with **Rust** and **Tauri**, it provides a native database management experience in a minimal package.

> **At just ~8.5MB**, Dora is tiny compared to **pgAdmin (~400MB)** or **Beekeeper Studio (~120MB)**.

> Manage connections, run queries, visualize data, and handle migrations efficiently without leaving your keyboard.

### Key Features

- **Performance**: Instant startup and negligible memory footprint (vs 100MB+ Electron apps).
- **Keyboard-Centric**: Optimized for efficiency; navigate and query without a mouse.
- **Local & Private**
  100% offline SQLite storage with no telemetry or cloud dependencies.
- **Cross-Platform**: Native support for Linux, macOS, and Windows.

## Download

Dora is natively available for Linux, MacOS and Windows(?) and offers building from source as well as the compiled release through the [releases](https://github.com/remcostoeten/dora/releases) page or via common package managers.
<small><i>Currently only linux builds are compiled, but macos and windows are supported.</i></small>

### Linux

## Development & Building

### Option 1: The Dora CLI (Recommended)

Dora comes with a custom CLI tool to manage builds, releases, and databases.
It is a single binary that works on any OS without any prerequisites. If you want to rebuild, or modify the CLI however you will need to have Go installed.

1. **Running the CLI**

    ```bash
    // in the root directory
    ./dora
    ```

    This opens an interactive menu to Run the app, Build artifacts, Generate release notes, or Manage your DB.

    **Example Output:**

    ```text
    ╭───────────────────────────────────────────────╮
    │  DORA DEVELOPMENT CONSOLE           v0.0.9    │
    ╰───────────────────────────────────────────────╯
    > Run all
      Run app...
      Build all
      Build specific platform...
      Run compiled builds...
      Install Build (.deb)...
      Uninstall Dora...
      Reinstall Build (.deb)...
      Check Build Sizes
      Database Management...
      ─────────────────────────
      Release Notes...
      AI Setup...
      Update/Rebuild Runner
      ─────────────────────────
      Visit GitHub Repo
      Go to Releases

    [↑/↓] Move • [Enter] Select • [Esc] Back • [q] Quit
    ```

2. **Build the CLI**
   <small><i>Only needed if you want to modify the CLI</i></small>
   `bash
cd tools/dora-cli
go build -o ../../dora .  # Outputs binary named 'dora' to root
cd ../..
`
   This will output a binary named 'dora' to the root directory.

### Option 2: Manual Setup

If you prefer standard tools, you can run Dora directly. I recommend **Bun** (or pnpm).

```bash
# Install dependencies
bun install

# Run web view (No database connection, purely frontned mock view stored in memory)
bun run dev

# Run Desktop App (Dev Mode)
bun run tauri dev

# Build React (Vite / Rolldown)
bun run build

# Build for Production
bun run tauri build
```

## Features (Early Beta)

Dora is in active development. Below is a list of implemented features available in the current build.

| Category         | Feature                  | Status | Description                                                 |
| :--------------- | :----------------------- | :----: | :---------------------------------------------------------- |
| **Connectivity** | **Connection Manager**   |  Done  | Save, pin, and organize database connections.               |
|                  | **SSH Tunneling**        |  Done  | Securely connect via SSH tunnels with key support.          |
|                  | **History**              |  Done  | Track recent connections for quick access.                  |
| **Data Studio**  | **Spreadsheet View**     |  Done  | Multi-cell selection, drag-select for rows/cols.            |
|                  | **Context Menu**         |  Done  | Right-click to duplicate, delete, or export (JSON/CSV/SQL). |
|                  | **Mutation History**     |  Done  | Local undo/redo stack for data changes.                     |
|                  | **Soft Delete**          |  Done  | Mark rows as deleted without removal (recoverable).         |
| **Querying**     | **Drizzle Query Runner** |  Done  | Custom **Drizzle LSP** for flawless autocompletion.         |
|                  | **Performance Stats**    |  Done  | Accurate query duration and execution timing.               |
|                  | **Snippets**             |  WIP   | Save/Delete scripts (Creation logic WIP).                   |
|                  | **Visual Builder**       |  WIP   | Drag-and-drop query building (In Progress).                 |
| **Schema**       | **Schema Export**        |  Done  | Export schema as SQL or **Drizzle ORM** definitions.        |
|                  | **Inspector**            |  Done  | View tables, keys, indices, and DDL.                        |
| **Tools**        | **Command Palette**      |  Done  | Keyboard-driven command menu (`Ctrl/Cmd + K`).              |
|                  | **Custom Shortcuts**     |  WIP   | Module ready, remapper UI under construction.               |

## Roadmap & Under Construction

| Feature                  | Status  | details                                                        |
| :----------------------- | :-----: | :------------------------------------------------------------- |
| **Microsoft SQL Server** |   WIP   | Initial implementation started.                                |
| **Prisma Support**       | Planned | Full LSP Query Runner, Snippets, and Schema Visualizer.        |
| **Schema Converters**    | Planned | Two-way conversion between **Prisma** <=> **Drizzle** schemas. |
| **AI Schema Gen**        | Planned | AI-assisted schema creation and migration generation.          |
| **NoSQL Support**        | Planned | MongoDB, Firebase (Planned).                                   |
| **Cloud Providers**      | Planned | Amazon RDS, Azure, Cloudflare D1.                              |
| **Detailed Metrics**     |   WIP   | Database size, table stats, detailed storage analysis.         |
| **Docker Tools**         | Planned | Container inspector & `docker-compose.yml` generator for DBs.  |
| **Snippet Folders**      | Planned | Organizing scripts into folders (File system/Storage).         |

> **Legend**: Done | WIP (Work in Progress) | Planned

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3). See the [LICENSE](LICENSE) file for details.

ignore this https://svg-sparkle-clean.lovable.app/

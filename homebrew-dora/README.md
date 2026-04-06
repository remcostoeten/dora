<div align="center">
  <h1>🍺 Homebrew Tap for Dora</h1>
  <p><i>Install <a href="https://github.com/remcostoeten/dora">Dora</a> — a fast, native database studio — via Homebrew.</i></p>

[![Homebrew](https://img.shields.io/badge/Homebrew-tap-FBB040?logo=homebrew&logoColor=white)](https://brew.sh/)
[![GitHub Release](https://img.shields.io/github/v/release/remcostoeten/dora?label=latest)](https://github.com/remcostoeten/dora/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/remcostoeten/dora/blob/master/LICENSE)

</div>

## Install

```bash
brew tap remcostoeten/dora
brew install dora
```

Or in a single command:

```bash
brew install remcostoeten/dora/dora
```

## Upgrade

```bash
brew update
brew upgrade dora
```

## Uninstall

```bash
brew uninstall dora
brew untap remcostoeten/dora
```

## Other Installation Methods

| Platform | Method                    | Link                                                             |
| :------- | :------------------------ | :--------------------------------------------------------------- |
| macOS    | `.dmg` installer          | [Releases](https://github.com/remcostoeten/dora/releases/latest) |
| Windows  | `.exe` / `.msi` installer | [Releases](https://github.com/remcostoeten/dora/releases/latest) |
| Linux    | `.AppImage`               | [Releases](https://github.com/remcostoeten/dora/releases/latest) |
| Linux    | `.deb` package            | [Releases](https://github.com/remcostoeten/dora/releases/latest) |
| Linux    | `.rpm` package            | [Releases](https://github.com/remcostoeten/dora/releases/latest) |

## What is Dora?

Dora is a cross-platform desktop database studio built with Tauri, Rust, and React. It supports PostgreSQL, SQLite, and LibSQL/Turso with features like inline editing, SQL console, Docker tooling, and SSH tunneling.

→ [Main repository](https://github.com/remcostoeten/dora)

## Formula Details

The formula downloads the appropriate release artifact for your platform and architecture:

- **macOS** — Intel (`x64`) or Apple Silicon (`aarch64`) `.dmg`
- **Linux** — `amd64` or `aarch64` `.AppImage`

> [!NOTE]
> SHA256 checksums will be populated once release artifacts are published. Until then you may see verification warnings.

## License

GNU General Public License v3.0. See the [main repo](https://github.com/remcostoeten/dora/blob/master/LICENSE) for details.

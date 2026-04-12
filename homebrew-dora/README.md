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
brew install --cask dora
```

Or in a single command:

```bash
brew install --cask remcostoeten/dora/dora
```

## Upgrade

```bash
brew update
brew upgrade --cask dora
```

## Uninstall

```bash
brew uninstall --cask dora
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

## Cask details

The cask installs the macOS desktop app from the GitHub release that matches
your CPU architecture:

- **Intel Macs** — `Dora_<version>_x64.dmg`
- **Apple Silicon Macs** — `Dora_<version>_aarch64.dmg`

Linux release artifacts remain available from the main Dora release page, but
they are not installed through this Homebrew tap.

## License

GNU General Public License v3.0. See the [main repo](https://github.com/remcostoeten/dora/blob/master/LICENSE) for details.

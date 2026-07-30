# Release channels — reference

Companion to `SKILL.md`. Everything here is read off
`.github/workflows/release.yml` and the six channel workflows it calls.

## Pipeline jobs

| Phase | Job | Workflow | Runner | Needs |
| --- | --- | --- | --- | --- |
| 0 | `prepare` | `release-dispatch.yml` | ubuntu-latest | manual dispatch |
| 1 | `preflight` | `release.yml` | ubuntu-latest | tag push `v*.*.*` |
| 2 | `release-linux` | `release.yml` | ubuntu-latest | `preflight` |
| 2 | `release-windows` | `release.yml` | windows-2022 | `preflight` |
| 2 | `release-macos` | `release.yml` | macos-latest | `preflight` |
| 3 | `publish-release` | `release.yml` | ubuntu-latest | all three builds |
| 4 | `post-release` | `release.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-aur` | `aur.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-homebrew` | `brew.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-apt` | `apt.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-winget` | `winget.yml` | ubuntu-latest + windows-2022 | `publish-release` |
| 4 | `publish-snap` | `snap.yml` | ubuntu-22.04 | `publish-release` |
| 4 | `build-flatpak` | `flatpak.yml` | ubuntu-24.04 | `publish-release` |

`concurrency` is `release-dispatch` for phase 0 and `release-<tag>` for the rest,
both with `cancel-in-progress: false`.

## Release assets by build job

`release-linux` uploads:

- `*.deb`, `*.rpm`, `*.AppImage`, `*.AppImage.sig`
- `dora-x86_64-unknown-linux-gnu.tar.gz` — the binary is extracted from the
  Tauri-built `.deb` with `dpkg-deb -x`, never from a bare `cargo build`, because
  a bare build falls back to the dev URL
- `checksums-linux.txt` (`.AppImage`, `.deb`, `.rpm`)

`release-windows` uploads NSIS output only:

- `*.exe`, `*.exe.sig`, `checksums-windows.txt` (`.exe`)

`release-macos` uploads, after asserting all three exist:

- `*.dmg`, `*.app.tar.gz`, `*.app.tar.gz.sig`

`publish-release` adds `latest.json`, built by
`tools/scripts/generate-latest-json.ts` from the `.sig` files. Twelve assets is
the normal count; the gate is at least eleven.

## Updater platform map

| Platform key | Updater artifact | Produced by |
| --- | --- | --- |
| `linux-x86_64` | `.AppImage` + `.AppImage.sig` | `release-linux` |
| `windows-x86_64` | `-setup.exe` (or `.exe`) + `.sig` | `release-windows` |
| `darwin-aarch64` | `.app.tar.gz` + `.app.tar.gz.sig` | `release-macos` |

All three are required by `REQUIRED_PLATFORMS`. There is no `darwin-x86_64`
build, so Intel macOS users reinstall rather than update. Adding one means a new
build job plus a case in `platformFor`.

The app polls the endpoint in `plugins.updater.endpoints` of
`apps/desktop/src-tauri/tauri.conf.json`, which is the `latest.json` on the
repository's latest release. The public key sits next to it in `pubkey`; the
private half is the `TAURI_SIGNING_PRIVATE_KEY` secret.

## Per channel

### AUR — `.github/workflows/aur.yml`

- Consumes `dora-x86_64-unknown-linux-gnu.tar.gz` from the release, polling 60
  times at 30s.
- Rewrites `pkgver`, `pkgrel=1`, the source URL and `sha256sums` in
  `packaging/aur/PKGBUILD` with `sed`, then generates `.SRCINFO` inside an
  `archlinux:latest` container via `makepkg --printsrcinfo`.
- Commits both files to `master` as `chore(aur): update dora to <version>`, then
  clones the AUR repo over SSH and pushes.
- Secrets: `AUR_SSH_PRIVATE_KEY`, `AUR_KNOWN_HOSTS`. Missing either: the commit to
  master still happens, the AUR push is skipped, the job is green.
- Verify: a new commit in the AUR `dora` repository.

### Homebrew — `.github/workflows/brew.yml`

- Consumes the asset ending `_aarch64.dmg`, polling 60 times at 30s; computes its
  SHA-256.
- Runs `bun run release:homebrew` to generate the Cask, uploads it as a build
  artifact, and pushes it to the tap when `publish` is true.
- Secret: `HOMEBREW_SSH_PRIVATE_KEY`. Missing: Cask generated, push skipped, job
  green.
- Verify: a new commit in the tap repository.

### APT — `.github/workflows/apt.yml`

- Consumes the asset ending `_amd64.deb`, polling 60 times at 30s.
- Runs `tools/scripts/generate-apt-repo.ts`, merges the output over the existing
  `gh-pages` content, and deploys to GitHub Pages when `publish` is true.
- Secret: `GPG_PRIVATE_KEY` for repo metadata signing. Requires Pages enabled and
  the `github-pages` environment.
- Version falls back to root `package.json` when dispatched with no tag.
- Verify: the Pages deployment URL on the job.

### Winget — `.github/workflows/winget.yml`

- Consumes the asset ending `_x64-setup.exe` plus `checksums-windows.txt`, each
  polling 60 times at 30s. The version is parsed out of the installer filename,
  not the tag.
- Runs `bun run release:winget` with `--installer-type=nullsoft`, uploads the
  manifests, then a second job on Windows runs `wingetcreate submit` on them.
  `submit` rather than `update`, because the package moved from MSI to NSIS and
  `update` cannot map that change onto the prior manifest.
- Secret: `WINGET_CREATE_GITHUB_TOKEN`. Missing: the submit job exits 0 without
  doing anything.
- Verify: a pull request against the winget-pkgs repository.

### Snap — `.github/workflows/snap.yml`

- Consumes no release asset. Builds from source with
  `bash scripts/snapcraft.sh --sudo --destructive-mode`.
- Pinned to `ubuntu-22.04` because the snap targets `base: core22`; a newer runner
  leaks newer glibc symbols into the binary and it fails at runtime inside the
  snap.
- Secret: `SNAPCRAFT_STORE_CREDENTIALS`. Missing, or `publish` false: the `.snap`
  is uploaded as a build artifact only and the job is green.
- Version falls back to root `package.json` when dispatched with no tag.
- Verify: a new revision in the `stable` channel of the Snap Store.

### Flatpak — `.github/workflows/flatpak.yml`

- Consumes no release asset. Validates the desktop entry and the AppStream
  metainfo, then builds `packaging/flatpak/io.github.remcostoeten.dora.yml` with
  `flatpak-builder` against GNOME runtime 48.
- Uploads `Dora-<version>-x86_64.flatpak` and the built repo as artifacts.
- No secret and no publish step. Flathub is a separate submission this repository
  does not automate.
- Version falls back to root `package.json` when dispatched with no tag.

## Manual and emergency entry points

| Need | Use |
| --- | --- |
| Retry one channel | that workflow's `workflow_dispatch`, same tag |
| Tag an existing SHA during recovery | `.github/workflows/tag-create.yml` |
| See readiness without changing anything | `bun run release:guide` |
| Rehearse the bump locally | `bun run release:prepare` (commits and tags locally) |
| Regenerate notes between two tags | `bun run generate:releasetext` |
| Rebuild a channel's output locally | `bun run release:aur`, `release:homebrew`, `release:winget`, `release:apt`, `release:flatpak:build`, `release:snap:build` |
| Isolated OS environments for packaging debugging | `bun run vm:lab` |

## Release notes selection

`publish-release` uses `.github/release-notes/<tag>.md` when it exists. Otherwise
it resolves the previous tag from `git tag --list 'v*' --sort=-version:refname`
and runs `git-cliff <prev>..<tag>`, configured by `cliff.toml`. Either way the
chosen text is both the release body and the `notes` field of `latest.json`, so
it is what the in-app updater shows.

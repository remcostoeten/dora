# Release channels — reference

Companion to `SKILL.md`. Everything here is read off
`.github/workflows/release.yml` and the channel workflows it calls.

## Pipeline jobs

| Phase | Job | Workflow | Runner | Needs |
| --- | --- | --- | --- | --- |
| 0 | `prepare` | `release-dispatch.yml` | ubuntu-latest | manual dispatch |
| 1 | `preflight` | `release.yml` | ubuntu-latest | tag push `v*.*.*` |
| 2 | `release-linux` | `release.yml` | ubuntu-latest, ubuntu-24.04-arm (optional) | `preflight` |
| 2 | `release-windows` | `release.yml` | windows-2022, windows-11-arm (optional) | `preflight` |
| 2 | `release-macos` | `release.yml` | macos-latest | `preflight` |
| 3 | `publish-release` | `release.yml` | ubuntu-latest | all builds; runs when macOS succeeded |
| 4 | `post-release` | `release.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-aur` | `aur.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-homebrew` | `brew.yml` | ubuntu-latest | `publish-release` |
| 4 | `publish-apt` | `apt.yml` | ubuntu-24.04 | `publish-release`, `build-flatpak` |
| 4 | `publish-winget` | `winget.yml` | ubuntu-latest + windows-2022 | `publish-release` |
| 4 | `publish-snap` | `snap.yml` | ubuntu-22.04 | `publish-release` |
| 4 | `build-flatpak` | `flatpak.yml` | ubuntu-24.04, ubuntu-24.04-arm (optional) | `publish-release` |
| 4 | `publish-packages` | `packages.yml` | ubuntu-latest + windows-2022 | `publish-release` |
| 4 | `publish-chocolatey` | `chocolatey.yml` | windows-2022 | `publish-release` |

`concurrency` is `release-dispatch` for phase 0 and `release-<tag>` for the rest,
both with `cancel-in-progress: false`.

## Release assets by build job

`release-linux` uploads:

- `*.deb`, `*.rpm`, `*.AppImage`, `*.AppImage.sig`
- `dora-<arch>-unknown-linux-gnu.tar.gz` — the binary is extracted from the
  Tauri-built `.deb` with `dpkg-deb -x`, never from a bare `cargo build`, because
  a bare build falls back to the dev URL
- `checksums-linux.txt`, or `checksums-linux-aarch64.txt` from the arm leg

`release-windows` uploads NSIS output only:

- `*.exe`, `*.exe.sig`, `checksums-windows.txt`, or `checksums-windows-arm64.txt`
  from the arm leg

`release-macos` uploads, after asserting all three exist:

- `*_universal.dmg`, `*.app.tar.gz`, `*.app.tar.gz.sig`, built with
  `--target universal-apple-darwin`; the DuckDB sidecar is merged with `lipo`

`publish-release` adds `latest.json`, built by
`tools/scripts/generate-latest-json.ts` from the `.sig` files. Twelve assets is
the normal count; the gate is at least eleven.

## Updater platform map

| Platform key | Updater artifact | Produced by |
| --- | --- | --- |
| `linux-x86_64` | `.AppImage` + `.AppImage.sig` | `release-linux` |
| `windows-x86_64` | `-setup.exe` (or `.exe`) + `.sig` | `release-windows` |
| `darwin-aarch64`, `darwin-x86_64` | universal `.app.tar.gz` + `.sig` | `release-macos` |
| `linux-aarch64` | `_aarch64.AppImage` + `.sig` | `release-linux` arm leg |
| `windows-aarch64` | `_arm64-setup.exe` + `.sig` | `release-windows` arm leg |

The first four are required by `REQUIRED_PLATFORMS`; the aarch64 keys are added
when their build shipped. The mapping lives in `platformsFor`.

The app polls the endpoint in `plugins.updater.endpoints` of
`apps/desktop/src-tauri/tauri.conf.json`, which is the `latest.json` on the
repository's latest release. The public key sits next to it in `pubkey`; the
private half is the `TAURI_SIGNING_PRIVATE_KEY` secret.

macOS signing and notarization use the `APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_PASSWORD` and `APPLE_TEAM_ID` secrets, staged into the job environment
by the "stage Apple signing and notarization credentials" step. All six or
none: a missing certificate only warns, a partial set fails the job. See
`docs/distribution/release-guide.md`.

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

- Consumes the asset ending `_universal.dmg`, polling 60 times at 30s; computes
  its SHA-256. The cask clears the quarantine flag in `postflight` because the app
  is not notarized.
- Runs `bun run release:homebrew` to generate the Cask, uploads it as a build
  artifact, and pushes it to the tap when `publish` is true.
- Secret: `HOMEBREW_SSH_PRIVATE_KEY`. Missing: Cask generated, push skipped, job
  green.
- Verify: a new commit in the tap repository.

### Linux repositories — `.github/workflows/apt.yml`

- Consumes `_amd64.deb`, `.x86_64.rpm` and `-x86_64.flatpak`, polling 60 times at
  30s, plus whatever arm64 packages the release carries.
- Builds the APT repo (`tools/scripts/generate-apt-repo.ts`, metadata read from
  each `.deb`), the DNF repo (`createrepo_c`, signed `repomd.xml.asc`) and the
  Flatpak remote (`flatpak build-import-bundle` + `build-update-repo`), then
  deploys the whole Pages site when `publish` is true.
- Secret: `GPG_PRIVATE_KEY`; the job fails without it. Requires Pages enabled
  and the `github-pages` environment.
- Verify: `https://remcostoeten.github.io/dora/dists/stable/InRelease`,
  `/rpm/repodata/repomd.xml` and `/flatpak/repo/summary` show the new version.

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
  `bash scripts/snapcraft.sh --sudo --destructive-mode`; the cargo build passes
  `--features tauri/custom-protocol` so the frontend is embedded.
- Pinned to `ubuntu-22.04` because the snap targets `base: core22`; a newer runner
  leaks newer glibc symbols into the binary and it fails at runtime inside the
  snap.
- Secret: `SNAPCRAFT_STORE_CREDENTIALS`. Missing, or `publish` false: the `.snap`
  is uploaded as a build artifact only and the job is green.
- Version falls back to root `package.json` when dispatched with no tag.
- Verify: a new revision in the `stable` channel of the Snap Store.

### Flatpak — `.github/workflows/flatpak.yml`

- Consumes `Dora_<version>_amd64.deb` (and `_arm64.deb` on the optional arm leg)
  and wraps it with `packaging/flatpak/build-flatpak.sh` against GNOME runtime 51.
  The build fails when a library is unresolved inside the runtime.
- Uploads `Dora-<version>-<arch>.flatpak` as a `dora-flatpak-*` run artifact
  (published releases are immutable, so nothing can be attached to them);
  `apt.yml` downloads the artifacts of its own run, or of `flatpak_run_id` when
  dispatched, and imports them into the Pages remote.
- Flathub is a separate one-time submission; see `packaging/flathub/README.md`.

### Scoop and Nix — `.github/workflows/packages.yml`

- Consumes the `.deb` files and `-setup.exe` installers. Generates
  `bucket/dora.json` and `release.json` with
  `tools/scripts/generate-package-manifests.ts`, adds the static files from
  `packaging/dora-packages`, test-installs with Scoop on Windows and builds the
  flake with Nix, then pushes to `remcostoeten/dora-packages`.
- Secret: `PACKAGES_DEPLOY_KEY`. Missing: everything is tested, the push is
  skipped, the job is green.
- Verify: a new commit in `remcostoeten/dora-packages`.

### Chocolatey — `.github/workflows/chocolatey.yml`

- Consumes `_x64-setup.exe`, renders `packaging/chocolatey`, packs, then
  installs and uninstalls the package on the runner.
- Secret: `CHOCOLATEY_API_KEY`. Missing: packed and tested, push skipped, job
  green.
- Verify: the new version on community.chocolatey.org (the first one waits for
  moderation).

## Manual and emergency entry points

| Need | Use |
| --- | --- |
| Retry one channel | that workflow's `workflow_dispatch`, same tag |
| Tag an existing SHA during recovery | `.github/workflows/tag-create.yml` |
| See readiness without changing anything | `bun run release:guide` |
| Rehearse the bump locally | `bun run release:prepare` (commits and tags locally) |
| Regenerate notes between two tags | `bun run generate:releasetext` |
| Rebuild a channel's output locally | `bun run release:aur`, `release:homebrew`, `release:winget`, `release:apt`, `release:packages`, `release:flatpak:build`, `release:snap:build` |
| Isolated OS environments for packaging debugging | `bun run vm:lab` |

## Release notes selection

`publish-release` uses `.github/release-notes/<tag>.md` when it exists. Otherwise
it resolves the previous tag from `git tag --list 'v*' --sort=-version:refname`
and runs `git-cliff <prev>..<tag>`, configured by `cliff.toml`. Either way the
chosen text is both the release body and the `notes` field of `latest.json`, so
it is what the in-app updater shows.

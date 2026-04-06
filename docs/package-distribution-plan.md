# Package Distribution Plan

## Goal

Ship Dora through additional package managers with a rollout that is realistic for the current repository and release pipeline.

Today the repo already produces these installable artifacts:

- macOS: `.dmg`
- Windows: `.exe`, `.msi`
- Linux: `.deb`, `.rpm`, `.AppImage`

That means most of the remaining work is distribution, metadata, signing, and release automation.

## Current State

### Already in place

- GitHub Actions release workflow at [release.yml](/home/remco/dev/dora/.github/workflows/release.yml)
- Tauri bundle targets in [tauri.conf.json](/home/remco/dev/dora/apps/desktop/src-tauri/tauri.conf.json)
- Homebrew tap in [homebrew-dora](/home/remco/dev/dora/homebrew-dora)

### Not yet in place

- Snap packaging config
- Winget manifests or submission automation
- Scoop manifest repo
- Chocolatey package
- AUR package metadata
- APT repository metadata and signing
- YUM/DNF repository metadata and signing

## Recommended Rollout Order

1. Winget
2. Snap
3. AUR
4. Scoop
5. Chocolatey
6. APT repository
7. YUM / DNF repository

This order gives the best ratio of user reach to maintenance cost. `apt` and `yum/dnf` sound simple, but they add the most infrastructure and signing overhead.

## Cross-Cutting Requirements

These should be done once before adding more package managers.

### Release asset naming

Standardize release artifact names so every package manager can consume stable URLs and predictable filenames.

Examples:

- `dora_${version}_amd64.deb`
- `dora_${version}_x86_64.rpm`
- `dora_${version}_amd64.AppImage`
- `Dora_${version}_x64_en-US.msi`
- `Dora_${version}_x64-setup.exe`
- `Dora_${version}_aarch64.dmg`

Action items:

- Review the exact filenames emitted by Tauri releases
- Keep naming stable across releases
- Avoid spaces and ambiguous architecture labels where possible

### Checksums

Every release should publish checksums for all assets.

Recommended file:

- `checksums.txt`

Recommended format:

```text
SHA256 (dora_0.1.0_amd64.deb)= ...
SHA256 (dora_0.1.0_x86_64.rpm)= ...
```

Action items:

- Add a CI step that computes SHA256 for each uploaded artifact
- Upload checksum files as release assets
- Reuse these checksums in package manager manifests

### Versioning

Keep one authoritative app version.

Action items:

- Ensure `package.json` and `tauri.conf.json` version fields stay aligned
- Use git tags like `v0.1.0`
- Prevent package manager manifests from drifting from release tags

### Signing

This becomes mandatory for the more serious distribution channels.

Required later for:

- APT repository metadata
- RPM repository metadata
- Windows reputation and installer trust
- Snap store publishing identity

Action items:

- Create a signing inventory document
- Decide which secrets live in GitHub Actions and which stay offline

## Package Manager Plans

## 1. Winget

### Why first

- Low implementation cost
- Good Windows reach
- Uses existing `.msi` or `.exe` artifacts
- No self-hosted repository needed

### Delivery model

Publish Dora releases to GitHub, then submit a Winget manifest pointing to the installer URLs and checksums.

### Requirements

- Stable GitHub release URLs
- One preferred Windows installer format
- SHA256 checksum per installer
- Publisher metadata that stays stable

### Recommended choice

Prefer `.msi` if it installs cleanly and upgrades reliably. Use `.exe` only if the Tauri NSIS installer behaves better in practice.

### Files to add

- `docs/distribution/winget.md`

Optional automation later:

- `.github/workflows/winget.yml`

### Exact instructions

1. Pick the canonical Windows artifact: `.msi` or `.exe`.
2. Confirm silent install and uninstall commands work.
3. Generate SHA256 for the installer.
4. Create Winget manifests:
    - `manifests/<publisher>/Dora/<version>/Dora.installer.yaml`
    - `manifests/<publisher>/Dora/<version>/Dora.locale.en-US.yaml`
    - `manifests/<publisher>/Dora/<version>/Dora.yaml`
5. Set:
    - `PackageIdentifier`
    - `PackageVersion`
    - `Publisher`
    - `PublisherUrl`
    - `PackageName`
    - `License`
    - `ShortDescription`
    - installer URL
    - SHA256
6. Submit manifests to `microsoft/winget-pkgs`.
7. After approval, document install and upgrade commands in the README.

### Install UX target

```bash
winget install Dora
winget upgrade Dora
```

### CI automation later

- On tag release:
    - fetch final asset URL
    - compute or read checksum
    - generate manifest
    - open PR against `winget-pkgs`

### Risks

- Installer metadata mismatch can block approval
- Publisher naming must stay consistent
- Silent install behavior may require manifest tuning

## 2. Snap

### Why second

- Good Linux coverage
- No need to host your own apt/yum repository
- Centralized publishing model

### Delivery model

Add `snapcraft.yaml`, build a `.snap`, and publish through Snapcraft.

### Requirements

- Snapcraft account
- Snap package name availability
- Clear confinement decision

### Confinement recommendation

Start by testing `strict`. If Dora needs desktop integration features that are blocked, document the exact interfaces required before falling back to `classic`.

### Files to add

- `snap/snapcraft.yaml`
- `docs/distribution/snap.md`

Optional:

- `.github/workflows/snap.yml`

### Exact instructions

1. Create a `snap/snapcraft.yaml`.
2. Define:
    - `name`
    - `base`
    - `version`
    - `summary`
    - `description`
    - `grade`
    - `confinement`
3. Add required app command and desktop plugs:
    - `desktop`
    - `desktop-legacy`
    - `wayland`
    - `x11`
    - `opengl`
    - `network`
    - `home`
4. Decide whether to package from a built binary or build from source in Snapcraft.
5. Build locally with `snapcraft`.
6. Install locally with `sudo snap install --dangerous ...snap`.
7. Verify:
    - app launches
    - file dialogs work
    - network/database connections work
    - icon and desktop entry work
8. Register the snap name in the Snap Store.
9. Publish to `edge`, then `beta`, then `stable`.

### Install UX target

```bash
sudo snap install dora
sudo snap refresh dora
```

### CI automation later

- Build snap on tagged release
- Push to Snap Store with a store token
- Release progressively through channels

### Risks

- Tauri desktop apps can hit confinement issues
- File access and system integration need explicit interfaces
- Store review may require metadata cleanup

## 3. AUR

### Why third

- Low infra overhead
- Popular with Arch users
- Good Linux credibility without maintaining a binary repository first

### Delivery model

Publish an AUR package that installs from a released artifact or builds from source.

### Recommended choice

Start with a binary package:

- `dora-bin`

This is easier because you already ship release artifacts.

Optional later:

- `dora` for source builds

### Files to add

- `packaging/aur/PKGBUILD`
- `packaging/aur/.SRCINFO`
- `docs/distribution/aur.md`

### Exact instructions

1. Create a `PKGBUILD` for `dora-bin`.
2. Point `source=()` to the GitHub release artifact URL.
3. Add the release checksum to `sha256sums=()`.
4. Install the binary, desktop file, icon, and license into the correct paths.
5. Generate `.SRCINFO`.
6. Test locally with `makepkg -si`.
7. Publish to the AUR package repo.
8. On each release:
    - update version
    - update checksum
    - regenerate `.SRCINFO`
    - push AUR changes

### Install UX target

```bash
yay -S dora-bin
paru -S dora-bin
```

### CI automation later

- Generate updated `PKGBUILD`
- Open or push changes to the AUR git repository using a deploy key

### Risks

- Binary package must match target architecture naming
- AUR users expect a maintained package
- AppImage vs extracted bundle layout may affect install simplicity

## 4. Scoop

### Why fourth

- Light operational overhead
- Works well if GitHub release assets are stable

### Delivery model

Create a Scoop manifest in a bucket repository that points to the Windows installer.

### Recommended choice

If the app can be made portable, Scoop is smoother. If not, use the installer and document the behavior carefully.

### Files to add

- `docs/distribution/scoop.md`

Likely separate repo:

- `dora-scoop-bucket`

### Exact instructions

1. Create a Scoop bucket repository or contribute to an existing bucket.
2. Add a manifest such as `bucket/dora.json`.
3. Set:
    - `version`
    - `description`
    - `homepage`
    - `license`
    - `url`
    - `hash`
4. If using an installer, define:
    - `innosetup` or `msi` install handling as needed
    - shortcuts
    - uninstall behavior
5. Test with:
    - `scoop bucket add ...`
    - `scoop install dora`
6. Document upgrade behavior.

### Install UX target

```bash
scoop bucket add dora https://github.com/remcostoeten/dora-scoop-bucket
scoop install dora
```

### Risks

- Scoop strongly prefers portable apps
- Installed location and update behavior can be awkward with some installers

## 5. Chocolatey

### Why fifth

- Still useful on Windows
- More packaging ceremony than Winget or Scoop

### Delivery model

Create a Chocolatey package that downloads and installs the Windows installer.

### Files to add

- `packaging/chocolatey/dora.nuspec`
- `packaging/chocolatey/tools/chocolateyinstall.ps1`
- `packaging/chocolatey/tools/chocolateyuninstall.ps1`
- `docs/distribution/chocolatey.md`

### Exact instructions

1. Create `dora.nuspec`.
2. Define package metadata:
    - id
    - version
    - authors
    - project URL
    - license URL
    - description
    - tags
3. Add PowerShell install and uninstall scripts.
4. Download the released installer from GitHub.
5. Verify checksums in the install script.
6. Test locally with `choco pack` and `choco install`.
7. Publish to Chocolatey community feed.

### Install UX target

```powershell
choco install dora
choco upgrade dora
```

### Risks

- Moderation can be slow
- Packaging rules are stricter than they look
- Installer silent flags must be correct

## 6. APT Repository

### Why later

- Very good Linux UX
- Highest maintenance among the common options

### Delivery model

Host a proper Debian repository with signed metadata so users can install with `apt install dora` after adding your repo.

### Requirements

- A public repository host
- GPG signing key
- CI that regenerates metadata on every release

### Hosting options

- GitHub Pages
- Cloudflare R2 + static site
- S3 + CloudFront
- A dedicated package host

### Files to add

- `packaging/apt/`
- `docs/distribution/apt.md`
- `.github/workflows/publish-apt.yml`

### Exact instructions

1. Create a GPG signing key dedicated to package metadata.
2. Export the public key for users to trust.
3. Create Debian repository structure:
    - `dists/stable/main/binary-amd64/`
    - `pool/main/`
4. Copy `.deb` artifacts into `pool/main/`.
5. Generate `Packages` and `Packages.gz` using `dpkg-scanpackages` or `aptly`.
6. Generate a `Release` file.
7. Sign metadata to produce:
    - `InRelease`
    - `Release.gpg`
8. Publish repository contents to the hosting origin.
9. Document install instructions using the signed key and source list.
10. Automate steps 4 through 8 in CI.

### Install UX target

```bash
curl -fsSL https://packages.dora.dev/public.gpg | sudo gpg --dearmor -o /usr/share/keyrings/dora-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/dora-archive-keyring.gpg] https://packages.dora.dev/apt stable main" | sudo tee /etc/apt/sources.list.d/dora.list
sudo apt update
sudo apt install dora
```

### Recommended tooling

Prefer a repository tool instead of hand-rolled shell:

- `aptly`
- `reprepro`

### Risks

- Key management and rotation
- Repository metadata corruption
- Extra support burden for Debian-family users

## 7. YUM / DNF Repository

### Why last

- Similar value to APT
- Similar maintenance overhead

### Delivery model

Host a signed RPM repository with generated metadata so users can install through `dnf` or `yum`.

### Requirements

- RPM signing key
- Repository host
- Metadata generation on each release

### Files to add

- `packaging/rpm-repo/`
- `docs/distribution/rpm-repo.md`
- `.github/workflows/publish-rpm-repo.yml`

### Exact instructions

1. Create an RPM signing key.
2. Sign the `.rpm` packages.
3. Create repository structure for published RPMs.
4. Run `createrepo_c` to build `repodata/`.
5. Publish RPMs and metadata to the repository host.
6. Publish the public key.
7. Document repository configuration for Fedora, RHEL, and compatible systems.
8. Automate publishing on each release.

### Install UX target

```bash
sudo rpm --import https://packages.dora.dev/RPM-GPG-KEY-dora
sudo dnf config-manager addrepo --from-repofile=https://packages.dora.dev/dora.repo
sudo dnf install dora
```

### Recommended tooling

- `createrepo_c`
- `gpg`
- optional repository hosting abstraction

### Risks

- RPM signing and metadata issues
- Slight distro differences between Fedora, RHEL, Rocky, Alma, and openSUSE

## Repo Changes To Schedule

## Phase 1

- Add `checksums.txt` generation to releases
- Standardize artifact naming
- Decide canonical Windows installer
- Add per-manager docs under `docs/distribution/`

## Phase 2

- Implement Winget
- Implement Snap
- Implement AUR

## Phase 3

- Implement Scoop
- Implement Chocolatey

## Phase 4

- Implement APT repository
- Implement RPM repository

## Secrets And Accounts Checklist

- GitHub token with release permissions
- Snapcraft store token
- AUR SSH key or maintainer credentials
- GPG key for APT repository
- GPG key for RPM signing
- Optional token or credentials for package hosting
- Optional Winget automation credentials if PR automation is used

## Validation Checklist Per Release

- All installers uploaded successfully
- Checksums published
- Install command works in a clean environment
- Upgrade path works from the previous release
- Uninstall works cleanly
- Desktop file and icons appear correctly where relevant
- Package metadata version matches the app version
- README and website installation docs stay aligned

## Recommendation

If the goal is to move fast without creating heavy maintenance overhead, start with:

1. Winget
2. Snap
3. AUR

If the goal is to maximize Linux package-manager polish for enterprise-style installs, add:

1. APT repository
2. RPM repository

Only do that after checksums, signing, and artifact naming are stable.

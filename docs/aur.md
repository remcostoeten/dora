# AUR packaging and publishing (`dora`)

This repository publishes a lightweight Arch Linux package named `dora` from GitHub Releases.

## Design choices

- Package **native Linux tarballs** (`dora-x86_64-unknown-linux-gnu.tar.gz`).
- **Do not package AppImage** artifacts.
- Install only what is needed:
  - binary: `/usr/bin/dora`
  - desktop file: `/usr/share/applications/dora.desktop`
  - icons: `/usr/share/icons/hicolor/.../apps/dora.png`

## 1) Create the AUR repository

1. Create/verify an AUR account.
2. Create the package repository for `dora` on AUR.
3. Clone the AUR repo:

```bash
git clone ssh://aur@aur.archlinux.org/dora.git
```

## 2) Generate and add SSH deploy key

Generate a dedicated SSH keypair for CI:

```bash
ssh-keygen -t ed25519 -C "github-actions-aur" -f ./aur_deploy_key
```

- Add `aur_deploy_key.pub` to your AUR account keys.
- Add private key contents (`aur_deploy_key`) to GitHub secret:
  - `AUR_SSH_PRIVATE_KEY`

## 3) GitHub Actions secrets

Configure repository secrets:

- `AUR_SSH_PRIVATE_KEY`: private key for `aur@aur.archlinux.org`.

## 4) Manual local validation

From repo root:

```bash
cd packaging/aur
makepkg -si
```

This validates PKGBUILD syntax, downloads the release tarball, verifies SHA256, and installs the package locally.

## 5) Publish flow overview

1. A GitHub Release is published (`vX.Y.Z`).
2. CI resolves release tag/version.
3. CI finds `dora-x86_64-unknown-linux-gnu.tar.gz` on the release.
4. CI computes SHA256 for the tarball.
5. CI updates:
   - `packaging/aur/PKGBUILD`
   - `packaging/aur/.SRCINFO`
6. CI commits packaging updates back to this repository.
7. CI pushes `PKGBUILD` and `.SRCINFO` to `dora` AUR repo via SSH key.

## 6) Expected release tarball structure

Expected lightweight Linux tarball contents:

```text
dora-x86_64-unknown-linux-gnu.tar.gz
└── dora-x86_64-unknown-linux-gnu/
    ├── dora
    ├── dora.desktop
    └── icons/
        ├── 32x32.png
        ├── 128x128.png
        └── 256x256.png
```

If desktop/icons are unavailable, the package still installs the `dora` executable.

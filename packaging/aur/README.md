# AUR Packaging

This directory stores the generated `dora` package files for AUR.

## Generate (local override)

```bash
bun run release:aur
```

Pass `-- --version=0.1.0` only when you need to override the latest local Git tag.

## Test locally (Arch only)

```bash
cd packaging/aur
makepkg -si
```

## Publish

Publishing is fully automated. When you publish a GitHub Release the CI:

1. Downloads `dora-x86_64-unknown-linux-gnu.tar.gz` from the release assets
2. Computes the SHA256
3. Updates `PKGBUILD` and regenerates `.SRCINFO` inside an Arch container
4. Commits the updated files back to `master`
5. Pushes `PKGBUILD` + `.SRCINFO` to `ssh://aur@aur.archlinux.org/dora.git`

Users can then install with:

```bash
yay -S dora
# or
paru -S dora
```

## First-time setup

Run the bootstrap script once to generate the SSH deploy key and upload it to GitHub:

```bash
bash packaging/aur/setup-aur-publishing.sh
```

Add the generated public key to your AUR account at https://aur.archlinux.org/account/

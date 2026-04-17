# AUR Packaging

This directory stores the generated `dora` package files for AUR.

## Generate

```bash
bun run release:aur
```

Pass `-- --version=0.1.0` only when you need to override the latest local Git tag.

## Test

```bash
cd packaging/aur
makepkg -si
```

## Publish

Copy `PKGBUILD` and `.SRCINFO` into the `dora` AUR repository and push them there.

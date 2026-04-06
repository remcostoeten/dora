# AUR Packaging

This directory stores the generated `dora-bin` package files for AUR.

## Generate

```bash
bun run release:aur -- \
  --version=0.1.0 \
  --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-linux.txt \
  --appimage-file=Dora_0.1.0_amd64.AppImage
```

## Test

```bash
cd packaging/aur
makepkg -si
```

## Publish

Copy `PKGBUILD` and `.SRCINFO` into the `dora-bin` AUR repository and push them there.

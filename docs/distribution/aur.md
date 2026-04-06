# AUR Distribution Guide

`AUR` support for Dora is set up as a binary package named `dora-bin`.

The package installs the published AppImage from GitHub Releases into `/opt/dora` and exposes a `dora` wrapper in `/usr/bin`. The wrapper uses `--appimage-extract-and-run`, which avoids requiring users to have FUSE configured.

## Generate package files

After a tagged Linux release exists:

```bash
bun run release:aur -- \
  --version=0.1.0 \
  --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-linux.txt \
  --appimage-file=Dora_0.1.0_amd64.AppImage
```

This writes:

- `packaging/aur/PKGBUILD`
- `packaging/aur/.SRCINFO`

## Validate locally

On an Arch-based machine:

```bash
cd packaging/aur
makepkg -si
```

That should install `dora-bin` and provide the `dora` command.

## Publish to AUR

1. Create or use the `dora-bin` package in AUR.
2. Clone the AUR git repo for `dora-bin`.
3. Copy in the generated `PKGBUILD` and `.SRCINFO`.
4. Commit and push to the AUR remote.

## Notes

- The remaining manual step is publishing the generated files to the AUR git repository.
- If Dora later ships a tarball instead of only an AppImage, the package can be tightened further.

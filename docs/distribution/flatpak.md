# Flatpak Packaging

Dora's Flatpak package lives under `packaging/flatpak` and uses the app ID
`io.github.remcostoeten.dora`.

## Build Locally

Install Flatpak and flatpak-builder, then run:

```bash
bun run release:flatpak:build
```

The script installs the GNOME 48 runtime/SDK into the user Flatpak
installation from Flathub, builds Dora with flatpak-builder, and writes a
single-file bundle to:

```bash
dora.flatpak
```

Install the local bundle with:

```bash
flatpak install --user dora.flatpak
flatpak run io.github.remcostoeten.dora
```

## CI

`.github/workflows/flatpak.yml` builds the same manifest on release publish and
manual workflow dispatch. When a tag is available, the generated
`Dora-<version>-x86_64.flatpak` bundle is uploaded back to that GitHub release.

This makes the GitHub release bundle installable with `flatpak install`, but it
does not make `flatpak install flathub io.github.remcostoeten.dora` work by
itself. That command requires a separate Flathub submission and review. The
manifest in this repo is the source package for that submission.

## Files

- `packaging/flatpak/io.github.remcostoeten.dora.yml` - Flatpak manifest.
- `packaging/flatpak/io.github.remcostoeten.dora.desktop` - desktop entry.
- `packaging/flatpak/io.github.remcostoeten.dora.metainfo.xml` - AppStream metadata.
- `packaging/flatpak/build-flatpak.sh` - local build helper.

# AUR Distribution Guide

`AUR` support for Dora is set up as a source-built package named `dora`.

The package builds Dora from the tagged source archive, installs the compiled binary into `/usr/bin/dora`, and adds the desktop entry and icon under the standard system paths.

## Generate package files

After the release tag exists on GitHub:

```bash
bun run release:aur
```

By default the script uses the latest local Git tag. Pass `-- --version=0.1.0` only when you need to override it.

This writes:

- `packaging/aur/PKGBUILD`
- `packaging/aur/.SRCINFO`

## Validate locally

On an Arch-based machine:

```bash
cd packaging/aur
makepkg -si
```

That should build and install `dora` and provide the `dora` command.

## Publish to AUR

1. Create or use the `dora` package in AUR.
2. Clone the AUR git repo for `dora`.
3. Copy in the generated `PKGBUILD` and `.SRCINFO`.
4. Commit and push to the AUR remote.

## Notes

- The remaining manual step is publishing the generated files to the AUR git repository.
- `yay -S dora` or `paru -S dora` is the user-facing install path once the package is live.
- `.github/workflows/aur.yml` can generate and publish the AUR package automatically when `AUR_SSH_PRIVATE_KEY` is configured and the repository variable `AUR_PACKAGE_READY=true` is set.

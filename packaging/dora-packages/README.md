# dora-packages

Package-manager metadata for [Dora](https://github.com/remcostoeten/dora), rewritten by the Dora release workflow on every release. Do not edit by hand; the sources live in `packaging/dora-packages` in the Dora repository.

## Scoop (Windows)

```powershell
scoop bucket add dora https://github.com/remcostoeten/dora-packages
scoop install dora
```

## Nix (Linux, x86_64 and aarch64)

```bash
nix run github:remcostoeten/dora-packages
nix profile install github:remcostoeten/dora-packages
```

Or add `github:remcostoeten/dora-packages` as a flake input and use `packages.<system>.dora` or `overlays.default`.

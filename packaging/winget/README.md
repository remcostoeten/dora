# Winget Packaging

This directory stores generated WinGet manifest files for Dora. The same
manifest structure is used locally and in `.github/workflows/winget.yml`.

## First package submission

On Windows, the simplest public submission flow is:

```powershell
winget install wingetcreate
wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi"
```

That creates and can submit the PR to `microsoft/winget-pkgs`.

After that package exists, the repo workflow can submit later updates
automatically with `wingetcreate update`.

## Generate manifests

Use the script after a tagged Windows release exists and you have the MSI URL plus SHA256 hash:

```bash
bun run release:winget -- \
  --version=0.1.0 \
  --installer-url=https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi \
  --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-windows.txt \
  --installer-file=Dora_0.1.0_x64_en-US.msi
```

The command writes three manifest files into `packaging/winget/manifests/<version>/`:

- version manifest
- default locale manifest
- installer manifest

The GitHub Actions workflow also archives those files into
`winget-manifests-<version>.tar.gz` and attaches that archive to the published
GitHub release.

## Validate locally

On Windows, validate the generated manifest folder with:

```powershell
winget validate --manifest .\packaging\winget\manifests\0.1.0
```

Then test local installation:

```powershell
winget settings --enable LocalManifestFiles
winget install --manifest .\packaging\winget\manifests\0.1.0
```

## Enable CI submissions

After the first package PR is merged into `microsoft/winget-pkgs`, add:

- `WINGET_CREATE_GITHUB_TOKEN` as a repository secret
- `WINGET_PACKAGE_READY=true` as a repository variable

That lets `.github/workflows/winget.yml` submit update PRs automatically for
published releases.

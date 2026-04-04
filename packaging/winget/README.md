# Winget Packaging

This directory stores generated WinGet manifest files for Dora.

## Preferred manual route

On Windows, the simplest public submission flow is:

```powershell
winget install wingetcreate
wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi"
```

That creates and can submit the PR to `microsoft/winget-pkgs`.

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

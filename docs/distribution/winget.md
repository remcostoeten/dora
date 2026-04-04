# Winget Distribution Guide

Winget is the simplest new channel because Dora already publishes Windows installers via Tauri. This document walks through the manual workflow so we can later automate it and keep the README in sync.

## Before releasing

1. **Pick the canonical installer** – prefer the `.msi` bundle because Winget handles it cleanly. Keep the `Dora_${version}_x64_en-US.msi` naming pattern stable so a manifest can point to a predictable URL.
2. **Build and upload assets** – the GitHub release must include:
    - `Dora_${version}_x64_en-US.msi` (or the defined installer)
    - `Dora_${version}_x64-setup.exe` (if we keep the NSIS installer for fallback)
    - `checksums.txt` that lists SHA256 hashes for every Windows artifact
3. **Publish release** – confirm that `docs/distribution/winget.md` remains aligned with the release tag (`vX.Y.Z`), because Winget manifests need the exact version string.

## Preferred submission flow

For the first public submission, prefer `wingetcreate new` on Windows. That is the path Microsoft documents most directly for creating and submitting a new package to `microsoft/winget-pkgs`.

```powershell
winget install wingetcreate
wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi"
```

During the prompts:

1. Confirm the detected package metadata.
2. Keep the package identifier stable.
3. Let `wingetcreate` submit the PR to `microsoft/winget-pkgs`.

For later releases, `wingetcreate update` is usually the better fit than re-authoring manifests from scratch.

## Repo-native manifest generation

The repo also contains a manifest generator. Keep this for deterministic local generation and future CI automation.

1. Build and publish the tagged Windows release.
2. Generate the Windows checksums file from the release bundle:

```bash
bun run release:checksums -- \
  --input-dir=apps/desktop/src-tauri/target/release/bundle \
  --output=apps/desktop/src-tauri/target/release/bundle/checksums-windows.txt \
  --extensions=.msi,.exe
```

3. Generate the three Winget manifest files:

```bash
bun run release:winget -- \
  --version=0.1.0 \
  --installer-url=https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi \
  --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-windows.txt \
  --installer-file=Dora_0.1.0_x64_en-US.msi
```

4. The repo writes:
    - `packaging/winget/manifests/<version>/Dora.yaml`
    - `packaging/winget/manifests/<version>/Dora.installer.yaml`
    - `packaging/winget/manifests/<version>/Dora.locale.en-US.yaml`
5. Validate locally with `winget validate --manifest <folder>` or `winget install --manifest <folder>`.
6. Either copy the generated files into a `winget-pkgs` fork manually, or use them as the source of truth when scripting `wingetcreate update`.

## Testing locally

After the manifest is merged:

1. `winget install Dora` – confirm the install succeeds and creates Start menu shortcuts.
2. `winget upgrade Dora` – test against a previous version to make sure upgrades are smooth.
3. `winget uninstall Dora` – ensure Dora is fully removed, including desktop icon and registry entries.

## Rolling out the manifest

1. Submit the PR to `microsoft/winget-pkgs`; `wingetcreate` can do this for you, or you can open the PR manually with the generated manifests.
2. Once the PR is merged, Winget users can run `winget install Dora` immediately. Track the manifest commit so we can update it each release.
3. Document the commands in our own README so users know how to install and keep the app updated.

## Automating in CI

- The release workflow now has the first needed building block: it uploads `checksums-windows.txt` for tagged Windows releases.
- The remaining automation step is either:
  - generating the manifest files from the published MSI URL and opening a PR against `microsoft/winget-pkgs`, or
  - calling `wingetcreate update` from a Windows automation context with a GitHub token.

Any automation should keep the manifest structure stable so updates are just data substitutions and PR metadata.

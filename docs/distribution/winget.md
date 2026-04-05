# Winget Distribution Guide

Winget is now partly automated in-repo. Dora can generate versioned manifests on
every published GitHub release, attach those manifests to the release, and
submit update PRs with `wingetcreate` after the package has been bootstrapped in
`microsoft/winget-pkgs`.

## Before releasing

1. **Pick the canonical installer** – prefer the `.msi` bundle because Winget handles it cleanly. Keep the `Dora_${version}_x64_en-US.msi` naming pattern stable so a manifest can point to a predictable URL.
2. **Build and upload assets** – the GitHub release must include:
    - `Dora_${version}_x64_en-US.msi` (or the defined installer)
    - `Dora_${version}_x64-setup.exe` (if we keep the NSIS installer for fallback)
    - `checksums.txt` that lists SHA256 hashes for every Windows artifact
3. **Publish release** – confirm that `docs/distribution/winget.md` remains aligned with the release tag (`vX.Y.Z`), because Winget manifests need the exact version string.

## First submission

The first public submission is still a one-time manual step. Microsoft documents
`wingetcreate new` as the starting point for creating the package entry in
`microsoft/winget-pkgs`.

```powershell
winget install wingetcreate
wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi"
```

During the prompts:

1. Confirm the detected package metadata.
2. Keep the package identifier stable.
3. Let `wingetcreate` submit the PR to `microsoft/winget-pkgs`.

After that PR is merged, Dora's `winget.yml` workflow can handle later updates.

## Repo-native manifest generation

The repo contains a manifest generator and a dedicated workflow:

- `tools/scripts/generate-winget-manifest.ts`
- `.github/workflows/winget.yml`

On every published GitHub release, the workflow:

1. Downloads `checksums-windows.txt` from the release.
2. Generates the three Winget manifest files.
3. Uploads a `winget-manifests-<version>.tar.gz` artifact.
4. Uploads that manifest archive to the GitHub release.
5. Optionally runs `wingetcreate update --submit` when automation is enabled.

You can still generate the manifests locally:

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
    - `packaging/winget/manifests/<version>/RemcoStoeten.Dora.yaml`
    - `packaging/winget/manifests/<version>/RemcoStoeten.Dora.installer.yaml`
    - `packaging/winget/manifests/<version>/RemcoStoeten.Dora.locale.en-US.yaml`
5. Validate locally with `winget validate --manifest <folder>` or `winget install --manifest <folder>`.
6. Either copy the generated files into a `winget-pkgs` fork manually, or use
   them as the source of truth when scripting `wingetcreate update`.

## Automated update setup

After the first package PR has merged, add the following repository settings:

1. Add the GitHub Actions secret `WINGET_CREATE_GITHUB_TOKEN`.
2. Use a classic GitHub personal access token with the `public_repo` scope.
3. Add the repository variable `WINGET_PACKAGE_READY=true`.

With that in place, each published GitHub release can submit a Winget update PR
automatically. Manual dispatch also supports a forced update submission for an
existing release tag.

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

- `release.yml` publishes `checksums-windows.txt` on every tagged Windows release.
- `winget.yml` consumes that checksum file and creates deterministic manifests.
- `winget.yml` can also submit update PRs through `wingetcreate` once the
  package already exists in `microsoft/winget-pkgs`.

The only remaining manual boundary is the very first public package submission.

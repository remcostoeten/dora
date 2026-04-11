# One-Machine Packaging Playbook

This is the shortest path if you only have one main machine and need to use Docker or VMs for the ecosystem-specific steps.

## VM bootstrap on Ubuntu

If you want the repo to manage the packaging VMs for you, start here:

```bash
bash tools/scripts/vm-lab.sh
```

Or directly:

```bash
bash tools/scripts/vm-lab.sh setup-host
bash tools/scripts/vm-lab.sh create ubuntu
bash tools/scripts/vm-lab.sh create arch
```

Details live in `docs/distribution/vm-lab.md`.

## First milestone: create a real tagged release

Package-manager publishing should start only after a real tagged release exists
and its assets are visible on the GitHub release page.

From the main repo:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then wait for the `Release` GitHub Actions workflow to finish. That workflow now uploads:

- release installers
- `checksums-linux.txt`
- `checksums-windows.txt`

Verify the release page first. If the release assets are missing, stop there and fix the release before touching Winget, AUR, or Snap.

## Winget from a Windows VM

Use a Windows 11 VM because `wingetcreate` is Windows-native. You need this VM
for the first public package submission only.

### In the VM

1. Install GitHub CLI and sign in if needed.
2. Install `wingetcreate`:

```powershell
winget install wingetcreate
```

3. Create the first package submission:

```powershell
wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v0.1.0/Dora_0.1.0_x64_en-US.msi"
```

4. Review the detected metadata carefully.
5. Let `wingetcreate` create the PR to `microsoft/winget-pkgs`.

### On later releases

Use:

```powershell
wingetcreate update RemcoStoeten.Dora --urls "https://github.com/remcostoeten/dora/releases/download/v0.1.1/Dora_0.1.1_x64_en-US.msi"
```

After the package exists in `microsoft/winget-pkgs`, you can stop doing that by
hand. Set `WINGET_CREATE_GITHUB_TOKEN` in GitHub Actions, add the repository
variable `WINGET_PACKAGE_READY=true`, and let `.github/workflows/winget.yml`
submit update PRs automatically from published releases.

## AUR from Docker on your main machine

You do not need a full Arch VM just to validate the package.

### Generate the package files

```bash
bun run release:aur -- \
  --version=0.1.0 \
  --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-linux.txt \
  --appimage-file=Dora_0.1.0_amd64.AppImage
```

### Validate in Docker

```bash
bash tools/scripts/test-aur-docker.sh
```

That spins up `archlinux:latest`, installs `base-devel`, and runs `makepkg` against `packaging/aur`.

### Publish to the real AUR repo

1. Create an AUR account at `aur.archlinux.org`.
2. Add your SSH key there.
3. Clone the AUR repo:

```bash
git clone ssh://aur@aur.archlinux.org/dora-bin.git ~/code/dora-bin-aur
```

4. Sync the generated files:

```bash
bash tools/scripts/sync-aur-repo.sh ~/code/dora-bin-aur
```

5. Commit and push:

```bash
cd ~/code/dora-bin-aur
git add PKGBUILD .SRCINFO
git commit -m "Update dora-bin to 0.1.0"
git push
```

## Snap from your main machine or GitHub Actions

Snap does not need a separate repo.

### Local build path

If your machine is Ubuntu or another Linux system with Snap available:

```bash
sudo snap install snapcraft --classic
sudo /snap/bin/snapcraft pack --destructive-mode
```

### CI build path

The repo now has:

- `.github/workflows/snap.yml`
- `snap/snapcraft.yaml`

When a GitHub release is published, the workflow installs Snapcraft, runs
`snapcraft pack --destructive-mode`, uploads the `.snap` to the release, and
publishes it to the Snap Store if the store credential secret exists. Manual
dispatch still works for artifact-only or test runs.

### Store publish path

1. Create or log into your Snapcraft account.
2. Register the `dora` snap name.
3. Export store credentials:

```bash
snapcraft export-login --snaps=dora \
  --acls package_access,package_push,package_update,package_release \
  exported.txt
```

4. Add the contents of `exported.txt` as the GitHub Actions secret
   `SNAPCRAFT_STORE_CREDENTIALS`.
5. Publish a GitHub release and let `.github/workflows/snap.yml` handle the
   build and store upload.

## Recommended order

1. Make the tagged GitHub release actually publish assets.
2. Submit Winget from a Windows VM.
3. Validate and publish AUR from Docker plus your normal host shell.
4. Register the Snap name and add `SNAPCRAFT_STORE_CREDENTIALS`.

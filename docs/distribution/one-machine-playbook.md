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

Right now the expected asset URLs still return `404`, so package-manager publishing should start only after a real tagged release exists.

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

Use a Windows 11 VM because `wingetcreate` is Windows-native.

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
snapcraft --destructive-mode
```

### CI build path

The repo now has:

- `.github/workflows/snap.yml`
- `snap/snapcraft.yaml`

Push a tag or run the workflow manually to build the `.snap` artifact in GitHub Actions.

### Store publish path

1. Create or log into your Snapcraft account.
2. Register the `dora` snap name.
3. Export store credentials:

```bash
snapcraft export-login --snaps dora --channels stable -
```

4. Add that exported blob as a GitHub Actions secret, for example `SNAPCRAFT_STORE_CREDENTIALS`.
5. Extend the workflow to run `snapcraft upload --release=stable *.snap`.

## Recommended order

1. Make the tagged GitHub release actually publish assets.
2. Submit Winget from a Windows VM.
3. Validate and publish AUR from Docker plus your normal host shell.
4. Register Snap name and then wire store publishing.

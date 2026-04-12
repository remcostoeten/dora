# Snap Distribution Guide

Snap support is wired in-repo. The GitHub Actions workflow builds the snap with
`snapcraft pack --destructive-mode`, uploads it as a workflow artifact, uploads
it to the GitHub release, and publishes it to the Snap Store when store
credentials are configured.

## What is in the repo

- `snap/snapcraft.yaml`
- `snap/gui/dora.desktop`
- `snap/local/launch`
- `.github/workflows/snap.yml`

The snap definition includes a `layout` entry for
`/usr/lib/$SNAPCRAFT_ARCH_TRIPLET/webkit2gtk-4.1`. WebKitGTK uses that
absolute path for helper processes such as `WebKitNetworkProcess`, so the snap
must bind it to the staged copy inside `$SNAP/usr/lib/...` at runtime.

## Build locally

On Ubuntu with Snapcraft installed:

```bash
sudo snap install snapcraft --classic
sudo /snap/bin/snapcraft pack --destructive-mode
```

That should produce a `.snap` artifact in the repository root.

The snap version is set during the build from the release tag when CI runs on a
published release. Local builds fall back to the version in `package.json`.

## CI build and publish

The GitHub Actions workflow at `.github/workflows/snap.yml` runs in two modes:

- On `release.published`, it builds the snap, uploads the `.snap` file to the
  GitHub release, and publishes it to the Snap Store if
  `SNAPCRAFT_STORE_CREDENTIALS` exists.
- On manual dispatch, it builds the snap as an artifact. You can optionally
  provide an existing release tag and turn on store publishing.

On GitHub Actions, the workflow installs Snapcraft and runs the same
`snapcraft pack --destructive-mode` command used for local Ubuntu builds. This
avoids the LXD-based action path and keeps CI aligned with the documented local
flow.

## Required one-time setup

You must complete the Snapcraft account setup once before GitHub Actions can
publish automatically.

1. Create or log into your Snapcraft account.
2. Register the `dora` snap name.
3. Export store credentials with the required ACLs:

```bash
snapcraft export-login --snaps=dora \
  --acls package_access,package_push,package_update,package_release \
  exported.txt
```

4. Save the contents of `exported.txt` as the GitHub Actions secret
   `SNAPCRAFT_STORE_CREDENTIALS`.

After that, every published GitHub release can publish the snap to the chosen
channel without additional manual steps.

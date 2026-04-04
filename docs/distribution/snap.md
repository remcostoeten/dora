# Snap Distribution Guide

Snap support is now scaffolded in-repo.

## What is in the repo

- `snap/snapcraft.yaml`
- `snap/gui/dora.desktop`
- `snap/local/launch`
- `.github/workflows/snap.yml`

## Build locally

On Ubuntu with Snapcraft installed:

```bash
sudo snap install snapcraft --classic
sudo /snap/bin/snapcraft pack --destructive-mode
```

That should produce a `.snap` artifact in the repository root.

## CI build

The GitHub Actions workflow at `.github/workflows/snap.yml` builds the snap on tag pushes and on manual dispatch, then uploads the `.snap` as a workflow artifact.

## Publish later

Publishing to the Snap Store still needs two external steps:

1. Register the `dora` snap name in Snapcraft.
2. Add exported Snapcraft credentials to GitHub Actions before automating `snapcraft upload`.

Until those credentials exist, the repo is set up for build validation but not automatic store publishing.

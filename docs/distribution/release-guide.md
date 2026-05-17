# Interactive Release Guide

Run this from your normal shell, including `fish`:

```bash
bash tools/scripts/release-guide.sh
```

The script gives you an interactive menu that:

- checks branch, tag, versions, dirty worktree, and GitHub auth
- generates a release notes draft from `CHANGELOG.md`
- creates the local tag when the tree is clean
- pushes the tag
- explains the automated GitHub release path
- prints package-manager follow-up commands for manual verification

It intentionally refuses to create a tag while the worktree is dirty.

Do not create or publish the GitHub release manually. Pushing the semver tag
starts `.github/workflows/release.yml`; that workflow creates a draft release,
uploads every Tauri asset, writes release notes, and only then publishes the
release. The package-manager workflows are wired to `release: published`, so
they should only run after the assets they consume exist.

Manual publication before the release workflow finishes is the failure mode that
causes APT, AUR, Homebrew, and Winget to fail immediately on missing assets.

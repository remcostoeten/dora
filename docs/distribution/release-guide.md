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
- creates the GitHub release with the generated notes
- prints the next AUR command and the one-time bootstrap steps for Winget and
  Snap if those channels are not configured yet

It intentionally refuses to create a tag while the worktree is dirty.

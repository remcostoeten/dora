---
name: dora-release-cut
description: Cutting a Dora release and recovering a broken one. Use when shipping a new version, changing what a version bump writes, changing the release or release-dispatch workflow or any of the six channel workflows (AUR, Homebrew, APT, Winget, Snap, Flatpak), changing the updater manifest or its signing, or diagnosing a tag that produced no build, a missing release asset, or a channel that did not publish. Not for what the app bundles at runtime and not for release-note prose.
---

# Cutting a release

## Scope

This skill owns the path from "master is ready" to "every channel has the new
version", and the recovery when part of that path fails. It owns the version
sources of truth, the dispatch entry points, the CI pipeline's gates, and the
per-channel publish and verify story.

It does not own what goes into the bundle, what the updater plugin does at
runtime, or how release notes are worded.

Entry points: `scripts/release.sh`, `scripts/ship.sh`, `scripts/release-prepare.sh`,
`tools/scripts/release-guide.sh`. Pipeline: `.github/workflows/release-dispatch.yml`
then `.github/workflows/release.yml`.

## Unencodable

Source gives no answer. Ask before deciding.

- Which bump level a given release deserves. `git-cliff --bumped-version` accepts
  whatever it is told; nothing derives it from the commits.
- Whether the `WINGET_PACKAGE_READY` repository variable matters.
  `docs/distribution/release-guide.md` tells you to set it; no workflow reads it.
- Whether a channel that skipped its publish step for a missing secret should
  count as a failed release. Four workflows deliberately exit 0 in that case.

## Workflow

**Rule: a release is one command and one CI run. Do not perform any part of it by
hand.** From a clean, pushed `master`:

```bash
bun run release:guide
bun run ship
```

`ship` runs the TypeScript and Rust suites, refuses on a dirty tree or unpushed
commits, then calls `bun run release`, which dispatches Release dispatch with
`gh`. `bun run ship --no-release` is the tests-only half; `bun run release minor`
and `bun run release major` skip the tests. From there you watch exactly one
thing: the Release run for the new tag.

**Rule: curated release notes must exist before the tag is pushed.** Add
`.github/release-notes/<tag>.md` for the tag you are about to create and commit
it first. `publish-release` reads that file if it is there and falls back to
git-cliff output; there is no later hook.

**Rule: `bun run release:prepare` is a local rehearsal, not a dry run.** It bumps
the version files, rewrites `CHANGELOG.md`, commits and tags locally. Reset the
commit and delete the tag before dispatching, or your tree is permanently ahead
of the release CI will actually cut.

## Invariants

**Only three things about a release are manual: the bump level, the optional
curated notes file, and the store secrets.** Version files, `CHANGELOG.md`,
in-app changelog data, the commit, the tag, every platform build, checksums, the
GitHub release, `latest.json`, the README bump and all six channels are scripted.
`bun run release:aur`, `bun run release:homebrew`, `bun run release:winget`,
`bun run release:apt`, `bun run release:flatpak:build` and
`bun run release:snap:build` exist to reproduce a channel's output locally. CI
calls the Homebrew, Winget and APT generators itself; it never calls
`release:aur` — `.github/workflows/aur.yml` patches `packaging/aur/PKGBUILD` with
`sed` in-workflow. Running any of them locally and committing the result
publishes nothing.

**Five files carry the version and one script writes all five.**
`scripts/bump-version.mjs` writes, in order: `package.json`,
`apps/desktop/package.json`, `apps/desktop/src-tauri/tauri.conf.json`,
`apps/desktop/src-tauri/Cargo.toml`, then the `dora` entry in
`apps/desktop/src-tauri/Cargo.lock`. Never edit one of them directly.

**The tag is decided before any file is written.** `scripts/release-prepare.sh`
asks `git-cliff --bumped-version` for the next tag, then bumps the files to match
it. Files follow the tag, never the reverse.

**Build-time authority is tag == desktop package == Tauri config == Cargo.**
`preflight` fails on any mismatch between those four. Root `package.json`
disagreeing is only a warning there — but it is the version
`.github/workflows/snap.yml` and `.github/workflows/flatpak.yml` fall back to
when dispatched without a tag, so it must not be left behind.

**Prepare writes in a fixed order and lands as exactly one commit.** Bumped tag →
version files → a new section prepended above `## [Unreleased]` in `CHANGELOG.md`
→ in-app changelog data via `scripts/sync-changelog-data.ts`
(`packages/studio/src/features/sidebar/changelog-data.ts` and
`apps/marketing/src/core/content/changelog-data.ts`) → one commit
`chore(release): <tag>` → the tag → push master, then push the tag.

**Local prerequisites are an authenticated `gh` and a clean, pushed tree.**
`git-cliff` is needed only on the local path; CI installs it. The tree checks are
enforced twice, in `scripts/ship.sh` locally and in `scripts/release-prepare.sh`
on the runner, because the remote builds from origin and would otherwise publish
code you never pushed.

**A missing CI secret fails at a different place for each secret.** No
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: builds pass,
no `.sig` files are produced, and `publish-release` dies at the updater manifest.
No `RELEASE_PAT`: the tag is pushed with `GITHUB_TOKEN`, which cannot trigger
another workflow, so `.github/workflows/release.yml` never starts. A missing
store secret: the channel job goes green having published nothing.

**Publish order is fixed and one-way.** `preflight` → the Linux, Windows and
macOS builds in parallel → `publish-release` → `post-release` and all six channel
jobs in parallel. Only `publish-release` creates the GitHub release, and every
channel that consumes an asset polls the published release for up to thirty
minutes before failing. Never start a channel before its release exists.

**The asset set is gated twice, both gates in `.github/workflows/release.yml`.**
A count of at least 11 files, and seven required patterns: `.exe`, `.exe.sig`,
`.AppImage`, `.AppImage.sig`, `.dmg`, `.app.tar.gz`, `.app.tar.gz.sig`. A green
`publish-release` proves those seven exist. It proves nothing about the `.deb`,
`.rpm`, the Linux tarball or the checksum files — their absence surfaces later as
a failing channel job, not here.

**The updater manifest is verified by construction, not by inspection.**
`tools/scripts/generate-latest-json.ts` asserts that `linux-x86_64`,
`windows-x86_64` and `darwin-aarch64` all resolved from a `.sig` file and throws
otherwise, so a platform dropping out fails the publish instead of shipping a
manifest silently missing it.

**`bundle.targets` in `apps/desktop/src-tauri/tauri.conf.json` must keep `app`,
and `createUpdaterArtifacts` must stay true.** `app` is the target that produces
the macOS `.app.tar.gz`; with an explicit target list that omits it the bundler
deletes the `.app` and macOS never reaches the manifest. `preflight` fails on
either, and on a missing `deb`, `rpm`, `appimage`, `nsis` or `dmg`.

**Recovery is per-channel, never per-release.** Re-run only the failed channel
through its own `workflow_dispatch` with the same tag. Every channel workflow
keeps that trigger, and every commit or push step inside them is a no-op when
nothing changed, so a re-run is safe.

**A release that already has assets is final.** `publish-release` deletes an
empty pre-created release and recreates it, but refuses a tag whose release
carries assets. So re-running the whole Release run to fix one channel goes red
before it reaches that channel. If `publish-release` itself is what failed, get
the release back to zero assets (delete it) and re-run the run.

**A tag with no Release run means `RELEASE_PAT` was absent.** Delete and re-push
the tag. Do not dispatch Release dispatch again — that bumps a second version.

**`.github/workflows/tag-create.yml` is recovery-only.** It tags an existing SHA
and bumps nothing, so using it for a normal release produces a tag whose version
files do not match it, which `preflight` rejects.

**The Release run's own job list is the post-release check.** Every channel is a
`workflow_call` job inside it, so a green run means every channel ran. There is
no reason to read each channel workflow's separate history.

**Green does not mean published for AUR, Homebrew, Winget and Snap.** Each skips
its publish step when its secret is unset and still exits 0. Confirm the
downstream artifact itself — the AUR repo commit, the tap commit, the winget-pkgs
PR, the Snap Store revision. APT and Flatpak have no such skip.

**Master moves by two or three commits per release.** `chore(release): <tag>`
from prepare, the README commit from `post-release`, and
`chore(aur): update dora to <version>` from the AUR job when the PKGBUILD
changed. A release where master moved once did not finish.

## Common mistakes

- Editing a version file, writing the CHANGELOG section, creating the tag, or
  creating the GitHub release by hand.
- Adding an Intel macOS or MSI asset based on an obsolete release assumption;
  the workflow has three platform jobs, NSIS on Windows and an 11-asset gate.
- Adding `.github/release-notes/<tag>.md` after the tag was pushed.
- Re-dispatching Release dispatch to retry anything, which cuts a second version.
- Re-running the whole Release run to fix a single channel.
- Dropping `app` from the bundle targets, or turning off `createUpdaterArtifacts`,
  which removes macOS from the updater without failing any build.
- Bumping the desktop, Tauri and Cargo versions but leaving root `package.json`
  behind, which preflight only warns about and Snap and Flatpak then pick up.
- Reading a channel workflow's own run history instead of the Release run.
- Treating a green AUR, Homebrew, Winget or Snap job as proof of publication.
- Running `bun run release:aur` locally and committing the PKGBUILD, expecting
  that to reach AUR.
- Using `.github/workflows/tag-create.yml` for a normal release.
- Leaving the local commit and tag from `bun run release:prepare` in place.

## Verification

Before dispatching, from the repository root:

```bash
bun run release:guide
bun run ship --no-release
```

`release:guide` reports branch, worktree cleanliness, the four versions side by
side, the latest tag, whether the remote tag and GitHub release already exist,
and whether `gh` is authenticated. `ship --no-release` is the same test pass the
release path runs before dispatching.

After dispatching, verification is the Release run plus the four downstream
artifacts listed under the green-is-not-published rule. See `reference.md` for
what each channel consumes, produces and is checked by.

## Definition of done

- The version came from `scripts/bump-version.mjs`, all five files agree, and the
  tag matches the desktop, Tauri and Cargo versions.
- No version file, CHANGELOG section, tag, or GitHub release was produced by hand.
- A curated `.github/release-notes/<tag>.md` was committed before the tag push, or
  git-cliff output was accepted deliberately.
- The Release run for the tag is green end to end, including all six channel jobs.
- The release carries the seven required patterns and a `latest.json` listing
  `linux-x86_64`, `windows-x86_64` and `darwin-aarch64`.
- For AUR, Homebrew, Winget and Snap, the downstream artifact was checked, not
  just the job status.
- Master carries the release commit and the README commit.
- Any failed channel was recovered through its own `workflow_dispatch` with the
  same tag, not by re-tagging or re-running the release.

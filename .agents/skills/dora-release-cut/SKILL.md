---
name: dora-release-cut
description: Cutting a Dora release and recovering a broken one. Use when shipping a new version, changing what a version bump writes, changing the release workflow, release-render.json or scripts/release-changelog.sh, or any of the channel workflows (AUR, Homebrew, Linux repositories, Winget, Snap, Flatpak, Scoop and Nix, Chocolatey), changing the updater manifest or its signing, or diagnosing a tag that produced no build, a missing release asset, or a channel that did not publish. Not for what the app bundles at runtime and not for release-note prose.
---

# Cutting a release

## Scope

This skill owns the path from "master is ready" to "every channel has the new
version", and the recovery when part of that path fails. It owns the version
sources of truth, the release entry points, the CI pipeline's gates, and the
per-channel publish and verify story.

It does not own what goes into the bundle, what the updater plugin does at
runtime, or how release notes are worded.

Entry points: the Release Render desktop app, which reads `release-render.json`
and runs `scripts/release-changelog.sh` as its prepare step, plus `scripts/ship.sh`
and `tools/scripts/release-guide.sh`. Pipeline: Release Render pushes the tag, then
`.github/workflows/release.yml`.

## Unencodable

Source gives no answer. Ask before deciding.

- Which bump level a given release deserves. Release Render preselects one from
  the conventional commits since the last tag, but the choice is the releaser's.
- Whether the `WINGET_PACKAGE_READY` repository variable matters.
  `docs/distribution/release-guide.md` tells you to set it; no workflow reads it.
- Whether a channel that skipped its publish step for a missing secret should
  count as a failed release. Six workflows deliberately exit 0 in that case.

## Workflow

**Rule: a release is one Release Render release and one CI run. Do not perform any
part of it by hand.** With everything merged to `master`:

```bash
bun run release:guide
bun run ship
```

`ship` runs the TypeScript and Rust suites and nothing else. Then open the
checkout in Release Render, choose **Dry run** to see every file and command,
and **New release** to cut it. The app bumps the version files, runs
`scripts/release-changelog.sh`, writes the notes file, commits, tags, and pushes
`master` and the tag atomically. From there you watch exactly one thing: the
Release run for the new tag, which the app follows in its **Logs** view.

**Rule: curated release notes must exist before the tag is pushed.** Add
`.github/release-notes/<tag>.md` for the tag you are about to create and commit
it first. Release Render then uses that file as the release notes and leaves it
unchanged, unless the notes are edited in the release dialog. Without it, the app
writes its generated notes to that path in the release commit. `publish-release`
reads that file and falls back to git-cliff output only when it is missing; there
is no later hook.

**Rule: rehearse with Dry run.** Release Render's **Dry run** lists every file it
would write and every command it would run, and changes nothing.

## Invariants

**Only three things about a release are manual: the bump level, the optional
curated notes file, and the store secrets.** Version files, `CHANGELOG.md`,
in-app changelog data, the commit, the tag, every platform build, checksums, the
GitHub release, `latest.json`, the README bump and every channel are scripted.
`bun run release:aur`, `bun run release:homebrew`, `bun run release:winget`,
`bun run release:apt`, `bun run release:flatpak:build` and
`bun run release:snap:build` exist to reproduce a channel's output locally. CI
calls the Homebrew, Winget and APT generators itself; it never calls
`release:aur` — `.github/workflows/aur.yml` patches `packaging/aur/PKGBUILD` with
`sed` in-workflow. Running any of them locally and committing the result
publishes nothing.

**Five files carry the version and Release Render writes all five.**
`release-render.json` lists `package.json`, `apps/desktop/package.json`,
`apps/desktop/src-tauri/Cargo.toml` and `apps/desktop/src-tauri/tauri.conf.json`
as version files, and the app updates the `dora` entry in
`apps/desktop/src-tauri/Cargo.lock` with the Cargo manifest. Never edit one of
them directly. `scripts/bump-version.mjs` writes the same five and is no longer
part of the release path.

**The tag is decided before any file is written.** Release Render bumps the
newest `v` tag by the chosen level, then writes the files to match it. Files
follow the tag, never the reverse.

**Build-time authority is tag == desktop package == Tauri config == Cargo.**
`preflight` fails on any mismatch between those four. Root `package.json`
disagreeing is only a warning there — but it is the version
`.github/workflows/snap.yml` and `.github/workflows/flatpak.yml` fall back to
when dispatched without a tag, so it must not be left behind.

**A release writes in a fixed order and lands as exactly one commit.** Bumped tag →
version files → `scripts/release-changelog.sh`, which prepends a new section above
`## [Unreleased]` in `CHANGELOG.md` and writes the in-app changelog data via
`scripts/sync-changelog-data.ts`
(`packages/studio/src/features/sidebar/changelog-data.ts` and
`apps/marketing/src/core/content/changelog-data.ts`) → the notes file → one commit
`chore(release): <tag>` → an annotated tag → one atomic push of master and the tag.

**Local prerequisites are `git-cliff`, `bun` and `python3` on `PATH`.** The
prepare step needs all three. Release Render refuses to release when the remote
moved since the plan or `master` has commits that are not on the remote, because
the remote builds from origin and would otherwise publish code you never pushed.

**A missing CI secret fails at a different place for each secret.** No
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: builds pass,
no `.sig` files are produced, and `publish-release` dies at the updater manifest.
A missing
store secret: the channel job goes green having published nothing.

**Publish order is fixed and one-way.** `preflight` → the Linux, Windows and
macOS builds in parallel → `publish-release` → `post-release` and every channel
job in parallel, except `publish-apt`, which also waits for `build-flatpak`. Only `publish-release` creates the GitHub release, and every
channel that consumes an asset polls the published release for up to thirty
minutes before failing. Never start a channel before its release exists.

**The asset set is gated twice, both gates in `.github/workflows/release.yml`.**
A count of at least 11 files, and twelve required patterns: the x86_64 set
(`_x64-setup.exe` and its `.sig`, `_amd64.AppImage` and its `.sig`, `_amd64.deb`,
`.x86_64.rpm`, the x86_64 tarball, `checksums-linux.txt`, `checksums-windows.txt`)
and the macOS set (`_universal.dmg`, `.app.tar.gz` and its `.sig`). The aarch64
Linux and arm64 Windows legs are `continue-on-error` and never required, so
`publish-release` runs whenever macOS succeeded and lets this gate decide.

**The updater manifest is verified by construction, not by inspection.**
`tools/scripts/generate-latest-json.ts` asserts that `linux-x86_64`,
`windows-x86_64`, `darwin-aarch64` and `darwin-x86_64` (both from the universal
`.app.tar.gz`) all resolved from a `.sig` file and throws
otherwise, so a platform dropping out fails the publish instead of shipping a
manifest silently missing it.

**`bundle.targets` in `apps/desktop/src-tauri/tauri.conf.json` must keep `app`,
and `createUpdaterArtifacts` must stay true.** `app` is the target that produces
the macOS `.app.tar.gz`; with an explicit target list that omits it the bundler
deletes the `.app` and macOS never reaches the manifest. `preflight` fails on
either, and on a missing `deb`, `rpm`, `appimage`, `nsis` or `dmg`.

**Recovery is per-channel, never per-release.** Re-run only the failed channel
through its own `workflow_dispatch` with the same tag, and set `publish` to true
where the workflow has that input (`apt.yml`, `brew.yml`, `snap.yml`,
`packages.yml`, `chocolatey.yml`), and `submit_update` to true for `winget.yml`;
all default to false. A failed `build-flatpak` also skips `publish-apt`, so
after recovering the Flatpak, dispatch `apt.yml` with `publish` true as well,
but only when that tag is still the latest release: `apt.yml` replaces the whole
Pages site, so deploying an older tag would roll APT, DNF and Flatpak back.
`packages.yml` follows the same rule: it replaces the contents of
`dora-packages`, so when the failed tag is no longer the latest, dispatch it
with the latest tag instead. Every channel workflow
keeps that trigger, and every commit or push step inside them is a no-op when
nothing changed, so a re-run is safe.

**A release that already has assets is final.** `publish-release` deletes an
empty pre-created release and recreates it, but refuses a tag whose release
carries assets. So re-running the whole Release run to fix one channel goes red
before it reaches that channel. If `publish-release` itself is what failed, get
the release back to zero assets (delete it) and re-run the run.

**A tag with no Release run was not pushed by a credential that can start
workflows, or does not match `v*.*.*`.** Delete and re-push the tag. Do not cut
another release to retry, which bumps a second version.

**`.github/workflows/tag-create.yml` is recovery-only.** It tags an existing SHA
and bumps nothing, so using it for a normal release produces a tag whose version
files do not match it, which `preflight` rejects.

**The Release run's own job list is the post-release check.** Every channel is a
`workflow_call` job inside it, so a green run means every channel ran. There is
no reason to read each channel workflow's separate history.

**Green does not mean published for AUR, Homebrew, Winget, Snap, Scoop and Nix,
and Chocolatey.** Each skips its publish step when its secret is unset and still
exits 0. Confirm the downstream artifact itself — the AUR repo commit, the tap
commit, the winget-pkgs PR, the Snap Store revision, the `dora-packages` commit,
the Chocolatey package version. The Linux repositories and Flatpak have no such
skip.

**Master moves by two or three commits per release.** `chore(release): <tag>`
from Release Render, the README commit from `post-release`, and
`chore(aur): update dora to <version>` from the AUR job when the PKGBUILD
changed. A release where master moved once did not finish.

## Common mistakes

- Editing a version file, writing the CHANGELOG section, creating the tag, or
  creating the GitHub release by hand.
- Adding a separate Intel macOS or an MSI asset; macOS ships one universal DMG
  and Windows ships NSIS only.
- Building a Linux channel with a bare `cargo build`. Without
  `--features tauri/custom-protocol` Tauri compiles in dev mode and the app
  loads `http://localhost:1420`. Wrap the released `.deb` instead, or pass the
  feature.
- Adding `.github/release-notes/<tag>.md` after the tag was pushed.
- Cutting another release to retry anything, which cuts a second version.
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

## Verification

Before releasing, from the repository root:

```bash
bun run release:guide
bun run ship
```

`release:guide` reports branch, worktree cleanliness, the four versions side by
side, the latest tag, whether the remote tag and GitHub release already exist,
and whether `gh` is authenticated. `ship` is the test pass to run before
releasing. Then run **Dry run** in Release Render.

After releasing, verification is the Release run plus the four downstream
artifacts listed under the green-is-not-published rule. See `reference.md` for
what each channel consumes, produces and is checked by.

## Definition of done

- The version came from a Release Render release, all five files agree, and the
  tag matches the desktop, Tauri and Cargo versions.
- No version file, CHANGELOG section, tag, or GitHub release was produced by hand.
- A curated `.github/release-notes/<tag>.md` was committed before the tag push, or
  git-cliff output was accepted deliberately.
- The Release run for the tag is green end to end, including every channel job.
- The release carries the twelve required patterns and a `latest.json` listing
  `linux-x86_64`, `windows-x86_64`, `darwin-aarch64` and `darwin-x86_64`.
- For AUR, Homebrew, Winget, Snap, Scoop and Nix, and Chocolatey, the
  downstream artifact was checked, not just the job status.
- Master carries the release commit and the README commit.
- Any failed channel was recovered through its own `workflow_dispatch` with the
  same tag, not by re-tagging or re-running the release.

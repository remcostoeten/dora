#!/usr/bin/env bash
# release-prepare.sh
# Bumps versions, prepends a git-cliff release section to CHANGELOG.md,
# syncs in-app changelog data, commits, and tags. Does not push.
#
# Usage: ./scripts/release-prepare.sh [patch|minor|major]
#   Writes NEXT_TAG to $GITHUB_OUTPUT when set (CI).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUMP="${1:-patch}"

if ! command -v git-cliff &>/dev/null; then
	echo "git-cliff is not installed. Install it with: cargo install git-cliff" >&2
	exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
	echo "Working tree is not clean. Commit or stash changes before releasing." >&2
	exit 1
fi

NEXT_TAG="$(git-cliff --bumped-version --bump "$BUMP" 2>/dev/null)"
NEXT_VERSION="${NEXT_TAG#v}"
PREV_TAG="$(git tag --list 'v*' --sort=-version:refname | head -1)"
TODAY="$(date -u +%Y-%m-%d)"

echo "━━ Preparing release ${NEXT_TAG} (from ${PREV_TAG:-<no prior tag>}) ━━"

bun scripts/bump-version.mjs "$NEXT_VERSION" >/dev/null
echo "Bumped version files to ${NEXT_VERSION}"

RANGE="${PREV_TAG}..HEAD"
if [[ -z "$PREV_TAG" ]]; then
	RANGE="HEAD"
fi

git-cliff "$RANGE" 2>/dev/null | sed "s/^## \\[Unreleased\\]/## [${NEXT_TAG}] - ${TODAY}/" >/tmp/release-section.md
if [[ ! -s /tmp/release-section.md ]]; then
	echo "No commits found for ${RANGE}." >&2
	exit 1
fi

python3 <<'PY'
import pathlib

new_section = pathlib.Path("/tmp/release-section.md").read_text(encoding="utf-8").rstrip() + "\n\n"
path = pathlib.Path("CHANGELOG.md")
text = path.read_text(encoding="utf-8")
marker = "## [Unreleased]"
idx = text.find(marker)
if idx == -1:
	raise SystemExit("CHANGELOG.md is missing an ## [Unreleased] section.")
path.write_text(text[:idx] + new_section + text[idx:], encoding="utf-8")
PY

echo "Prepended release section to CHANGELOG.md"

bun scripts/sync-changelog-data.ts
echo "Synced in-app changelog data"

git add \
	CHANGELOG.md \
	package.json \
	apps/desktop/package.json \
	apps/desktop/src-tauri/tauri.conf.json \
	apps/desktop/src-tauri/Cargo.toml \
	apps/desktop/src-tauri/Cargo.lock \
	packages/studio/src/features/sidebar/changelog-data.ts \
	apps/marketing/src/core/content/changelog-data.ts

git commit -m "chore(release): ${NEXT_TAG}"
git tag "$NEXT_TAG"

echo "Created commit and tag ${NEXT_TAG}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	echo "next_tag=${NEXT_TAG}" >>"$GITHUB_OUTPUT"
fi

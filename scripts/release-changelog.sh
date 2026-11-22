#!/usr/bin/env bash
# release-changelog.sh
# Prepends a git-cliff section for the next tag to CHANGELOG.md and syncs the
# in-app changelog data. Release Render runs it as the prepare step of a
# release (see release-render.json), after it bumped the version files and
# before it commits, tags and pushes.
#
# Usage: ./scripts/release-changelog.sh <next-tag> [previous-tag]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

NEXT_TAG="${1:?usage: release-changelog.sh <next-tag> [previous-tag]}"
PREV_TAG="${2:-}"
TODAY="$(date -u +%Y-%m-%d)"

if ! command -v git-cliff &>/dev/null; then
	echo "git-cliff is not installed. Install it with: cargo install git-cliff" >&2
	exit 1
fi

RANGE="${PREV_TAG}..HEAD"
if [[ -z "$PREV_TAG" ]]; then
	RANGE="HEAD"
fi

SECTION="$(mktemp)"
trap 'rm -f "$SECTION"' EXIT

git-cliff "$RANGE" 2>/dev/null | sed "s/^## \\[Unreleased\\]/## [${NEXT_TAG}] - ${TODAY}/" >"$SECTION"
if [[ ! -s "$SECTION" ]]; then
	echo "No commits found for ${RANGE}." >&2
	exit 1
fi

SECTION="$SECTION" python3 <<'PY'
import os
import pathlib

new_section = pathlib.Path(os.environ["SECTION"]).read_text(encoding="utf-8").rstrip() + "\n\n"
path = pathlib.Path("CHANGELOG.md")
text = path.read_text(encoding="utf-8")
marker = "## [Unreleased]"
idx = text.find(marker)
if idx == -1:
	raise SystemExit("CHANGELOG.md is missing an ## [Unreleased] section.")
path.write_text(text[:idx] + new_section + text[idx:], encoding="utf-8")
PY

echo "Prepended ${NEXT_TAG} to CHANGELOG.md"

bun scripts/sync-changelog-data.ts
echo "Synced in-app changelog data"

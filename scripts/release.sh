#!/usr/bin/env bash
# release.sh
# Bumps version, updates CHANGELOG.md, creates a git tag, pushes,
# and creates a GitHub release — all in one command.
#
# Usage: ./scripts/release.sh [patch|minor|major]
#   (default: patch)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BUMP="${1:-patch}"

if ! command -v git-cliff &>/dev/null; then
	echo "git-cliff is not installed. Install it with: cargo install git-cliff" >&2
	exit 1
fi

if ! command -v gh &>/dev/null; then
	echo "gh (GitHub CLI) is not installed." >&2
	exit 1
fi

NEXT_TAG="$(git-cliff --bumped-version --bump "$BUMP" 2>/dev/null)"

echo "━━ Release: $NEXT_TAG ━━"
echo

git-cliff -o CHANGELOG.md --tag "$NEXT_TAG" 2>/dev/null
echo "Updated CHANGELOG.md"
echo

git add CHANGELOG.md
git commit -m "chore(release): $NEXT_TAG"
git tag "$NEXT_TAG"

echo "Created tag $NEXT_TAG"
echo

git push origin master --follow-tags
echo "Pushed master and tag"
echo

PREV_TAG="$(git tag --list 'v*' --sort=-version:refname | sed -n 2p)"
RELEASE_NOTES="$(git-cliff "$PREV_TAG".."$NEXT_TAG" 2>/dev/null | sed -n '/^## /,/^<!-- generated/p' | sed '$d')"

gh release create "$NEXT_TAG" \
	--title "$NEXT_TAG" \
	--notes "$RELEASE_NOTES"

echo "━━ Created GitHub release: https://github.com/remcostoeten/dora/releases/tag/$NEXT_TAG ━━"

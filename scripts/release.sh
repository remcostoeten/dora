#!/usr/bin/env bash
# release.sh
# Triggers the automated release-dispatch workflow in GitHub Actions.
# CI bumps versions, updates CHANGELOG.md, tags, builds, and publishes.
#
# Usage: ./scripts/release.sh [patch|minor|major]
#   (default: patch)
#
# Local dry-run (no push): ./scripts/release-prepare.sh [patch|minor|major]

set -euo pipefail

BUMP="${1:-patch}"

if ! command -v gh &>/dev/null; then
	echo "gh (GitHub CLI) is not installed." >&2
	exit 1
fi

if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
	echo "Bump must be patch, minor, or major. Got: $BUMP" >&2
	exit 1
fi

echo "━━ Starting automated release (${BUMP} bump) ━━"
echo

gh workflow run release-dispatch.yml -f bump="$BUMP"

echo "Workflow dispatched."
echo
echo "Track progress:"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/workflows/release-dispatch.yml"
echo
echo "After prepare finishes, platform builds run here:"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions/workflows/release.yml"

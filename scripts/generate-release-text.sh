#!/usr/bin/env bash
# generate-release-text.sh
# Generates markdown release notes between the latest two version tags
# using git-cliff (already configured in cliff.toml).
#
# Usage: ./scripts/generate-release-text.sh
#   (optional) PREV_TAG=x.y.z NEXT_TAG=x.y.z  to override tag selection

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v git-cliff &>/dev/null; then
	echo "git-cliff is not installed. Install it with: cargo install git-cliff" >&2
	exit 1
fi

TAGS=($(git tag --list 'v*' --sort=-version:refname | head -5))

if [[ -z "${PREV_TAG:-}" && -z "${NEXT_TAG:-}" ]]; then
	NEXT_TAG="${TAGS[0]}"
	PREV_TAG="${TAGS[1]}"
elif [[ -z "${PREV_TAG:-}" ]]; then
	PREV_TAG=$(git tag --list 'v*' --sort=-version:refname | grep -A1 "^$NEXT_TAG$" | tail -1)
	if [[ "$PREV_TAG" == "$NEXT_TAG" ]]; then
		PREV_TAG="${TAGS[1]}"
	fi
fi

if [[ -z "$NEXT_TAG" ]]; then
	echo "No version tags found." >&2
	exit 1
fi

git-cliff "$PREV_TAG".."$NEXT_TAG" 2>/dev/null | sed -n '/^## /,/^<!-- generated/p' | sed '$d'

echo "**Full Changelog**: https://github.com/remcostoeten/dora/compare/$PREV_TAG...$NEXT_TAG"

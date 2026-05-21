#!/usr/bin/env bash
# generate-release-text.sh
# Generates markdown release notes between the latest two version tags.
# Output is ready to paste into a GitHub Release.
#
# Usage: ./scripts/generate-release-text.sh
#   (optional) PREV_TAG=x.y.z NEXT_TAG=x.y.z  to override tag selection

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ──────────────────────────────────────────────────────────────────
# Resolve tags
# ──────────────────────────────────────────────────────────────────
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

# ──────────────────────────────────────────────────────────────────
# Print release notes
# ──────────────────────────────────────────────────────────────────
echo "## [$NEXT_TAG]"
echo

ALREADY_MATCHED="/tmp/dora-release-matched.$$"
>"$ALREADY_MATCHED"

group() {
	local title="$1" pattern="$2"
	local IFS=$'\n'
	COMMITS=($(git log "$PREV_TAG..$NEXT_TAG" --no-merges --format="- %H %s" -E --grep="$pattern" 2>/dev/null || true))
	if [[ ${#COMMITS[@]} -gt 0 ]]; then
		echo "### $title"
		for c in "${COMMITS[@]}"; do
			hash="${c:2:40}"
			msg="${c:43}"
			echo "$hash" >> "$ALREADY_MATCHED"
			echo "- $msg"
		done
		echo
	fi
}

group "Features" "^feat"
group "Bug Fixes" "^fix"
group "Performance" "^perf"
group "Refactoring" "^refactor"
group "Documentation" "^docs"
group "Testing" "^test"
group "CI/CD" "^ci"
group "Chores" "^chore"

# Uncategorised (anything not caught above)
mapfile -t ALL_COMMITS < <(git log "$PREV_TAG..$NEXT_TAG" --no-merges --format="%H" 2>/dev/null || true)
OTHER=()
for h in "${ALL_COMMITS[@]}"; do
	if ! grep -qF "$h" "$ALREADY_MATCHED" 2>/dev/null; then
		msg=$(git log -1 --format="- %s" "$h" 2>/dev/null || true)
		OTHER+=("$msg")
	fi
done
rm -f "$ALREADY_MATCHED"

if [[ ${#OTHER[@]} -gt 0 ]]; then
	echo "### Other"
	for c in "${OTHER[@]}"; do
		echo "$c"
	done
	echo
fi

echo "**Full Changelog**: https://github.com/remcostoeten/dora/compare/$PREV_TAG...$NEXT_TAG"

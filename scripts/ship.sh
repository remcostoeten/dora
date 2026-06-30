#!/usr/bin/env bash
# ship.sh
# One-shot release gate: run every test suite (TypeScript + Rust), then trigger
# the automated GitHub release (bump version -> git-cliff changelog -> tag ->
# build all platforms -> publish).
#
# Usage:
#   bun run ship [patch|minor|major]      Run all tests, then release (default: patch).
#   bun run ship --no-release [bump]      Run all tests only; skip the release.
#
# The remote release builds from origin's default branch, so this aborts before
# dispatching if the working tree is dirty or local commits are unpushed —
# otherwise you would publish code that is not on the remote.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RELEASE=1
BUMP="patch"
for arg in "$@"; do
	case "$arg" in
	--no-release) RELEASE=0 ;;
	patch | minor | major) BUMP="$arg" ;;
	*)
		echo "Unknown argument: $arg (expected patch|minor|major or --no-release)" >&2
		exit 2
		;;
	esac
done

echo "━━ 1/3  TypeScript tests (turbo test) ━━"
bun run test

echo
echo "━━ 2/3  Rust tests (cargo test --lib) ━━"
(
	cd apps/desktop/src-tauri
	if command -v initdb >/dev/null 2>&1; then
		cargo test --lib
	else
		echo "note: initdb not found — skipping Postgres-backed tests locally (CI runs them)."
		cargo test --lib -- --skip database::postgres
	fi
)

if [[ "$RELEASE" -eq 0 ]]; then
	echo
	echo "✓ All tests passed. Release skipped (--no-release)."
	exit 0
fi

echo
echo "━━ pre-release checks ━━"
if [[ -n "$(git status --porcelain)" ]]; then
	echo "Working tree is not clean. Commit or stash before releasing — the remote build uses pushed code." >&2
	exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -n "$UPSTREAM" && -n "$(git log "${UPSTREAM}..HEAD" --oneline)" ]]; then
	echo "Local commits are not pushed to ${UPSTREAM}. Push first — the remote release builds from there." >&2
	exit 1
fi

echo
echo "━━ 3/3  Triggering ${BUMP} release ━━"
bun run release "$BUMP"

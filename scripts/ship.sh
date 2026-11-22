#!/usr/bin/env bash
# ship.sh
# Release gate: run every test suite (TypeScript + Rust). Cut the release itself
# from Release Render, which reads release-render.json.
#
# Usage: bun run ship

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "━━ 1/2  TypeScript tests (turbo test) ━━"
bun run test

echo
echo "━━ 2/2  Rust tests (cargo test --lib) ━━"
(
	cd apps/desktop/src-tauri
	if command -v initdb >/dev/null 2>&1; then
		cargo test --lib
	else
		echo "note: initdb not found — skipping Postgres-backed tests locally (CI runs them)."
		cargo test --lib -- --skip database::postgres
	fi
)

echo
echo "✓ All tests passed. Cut the release from Release Render."

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
NEXT_VERSION="${NEXT_TAG#v}"

echo "━━ Release: $NEXT_TAG ━━"
echo

# Bump version in all package files so the GitHub Actions preflight passes.
node - "$NEXT_VERSION" <<'NODE'
const fs = require('fs');
const version = process.argv[2];
const files = [
  'package.json',
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
];
for (const f of files) {
  const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(f, JSON.stringify(pkg, null, '\t') + '\n');
}
NODE

# Cargo.toml: bump the first `version = "..."` (the [package] one).
sed -i '0,/^version = ".*"/s//version = "'"$NEXT_VERSION"'"/' apps/desktop/src-tauri/Cargo.toml

# Cargo.lock: bump the `version = "..."` that immediately follows `name = "dora"`.
sed -i '/^name = "dora"$/{n;s/^version = ".*"/version = "'"$NEXT_VERSION"'"/;}' apps/desktop/src-tauri/Cargo.lock

echo "Bumped version files to $NEXT_VERSION"
echo

git-cliff -o CHANGELOG.md --tag "$NEXT_TAG"
echo "Updated CHANGELOG.md"
echo

git add CHANGELOG.md package.json apps/desktop/package.json apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.lock
git commit -m "chore(release): $NEXT_TAG"
git tag "$NEXT_TAG"

echo "Created tag $NEXT_TAG"
echo

git push origin master
git push origin "$NEXT_TAG"
echo "Pushed master and tag"
echo

PREV_TAG="$(git tag --list 'v*' --sort=-version:refname | sed -n 2p)"
RELEASE_NOTES="$(git-cliff "$PREV_TAG".."$NEXT_TAG" 2>/dev/null | sed -n '/^## /,/^<!-- generated/p' | sed '$d')"

gh release create "$NEXT_TAG" \
	--title "$NEXT_TAG" \
	--notes "$RELEASE_NOTES"

echo "━━ Created GitHub release: https://github.com/remcostoeten/dora/releases/tag/$NEXT_TAG ━━"

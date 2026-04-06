#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$ROOT_DIR/.agent/tmp"
mkdir -p "$TMP_DIR"

CURRENT_VERSION=""
ROOT_VERSION=""
DESKTOP_VERSION=""
TAURI_VERSION=""
CARGO_VERSION=""
CURRENT_BRANCH=""
LATEST_TAG=""
WORKTREE_CLEAN="no"
REMOTE_TAG_EXISTS="no"
RELEASE_EXISTS="no"
RELEASE_SUMMARY=""

red() { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
blue() { printf '\033[36m%s\033[0m\n' "$1"; }

command_exists() {
	command -v "$1" >/dev/null 2>&1
}

refresh_state() {
	ROOT_VERSION="$(python3 - <<'PY'
import json
print(json.load(open('package.json'))['version'])
PY
)"
	DESKTOP_VERSION="$(python3 - <<'PY'
import json
print(json.load(open('apps/desktop/package.json'))['version'])
PY
)"
	TAURI_VERSION="$(python3 - <<'PY'
import json
print(json.load(open('apps/desktop/src-tauri/tauri.conf.json'))['version'])
PY
)"
	CARGO_VERSION="$(python3 - <<'PY'
import re
text = open('apps/desktop/src-tauri/Cargo.toml', 'r', encoding='utf-8').read()
match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
print(match.group(1) if match else '')
PY
)"
	CURRENT_VERSION="$ROOT_VERSION"
	CURRENT_BRANCH="$(git branch --show-current)"
	LATEST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
	if [[ -z "$(git status --porcelain)" ]]; then
		WORKTREE_CLEAN="yes"
	else
		WORKTREE_CLEAN="no"
	fi

	if git ls-remote --tags origin "refs/tags/v$CURRENT_VERSION" | grep -q .; then
		REMOTE_TAG_EXISTS="yes"
	else
		REMOTE_TAG_EXISTS="no"
	fi

	if gh release view "v$CURRENT_VERSION" >/tmp/dora-release-guide-release.txt 2>/dev/null; then
		RELEASE_EXISTS="yes"
		RELEASE_SUMMARY="$(cat /tmp/dora-release-guide-release.txt)"
	else
		RELEASE_EXISTS="no"
		RELEASE_SUMMARY=""
	fi
}

write_release_notes_file() {
	local out_file="$TMP_DIR/release-notes-v${CURRENT_VERSION}.md"
	VERSION="$CURRENT_VERSION" python3 - <<'PY' > "$out_file"
import os
import re
from pathlib import Path

version = os.environ["VERSION"]
text = Path("CHANGELOG.md").read_text(encoding="utf-8")
pattern = re.compile(rf"^##\s+{re.escape(version)}\b.*?(?=^##\s+|\Z)", re.MULTILINE | re.DOTALL)
match = pattern.search(text)
if not match:
    raise SystemExit(f"Could not find CHANGELOG section for version {version}")
section = match.group(0).strip()
print(f"# Dora v{version}\n")
print(section)
PY
	printf '%s\n' "$out_file"
}

show_readiness() {
	refresh_state
	blue "Release readiness"
	printf 'Branch: %s\n' "$CURRENT_BRANCH"
	printf 'Latest tag: %s\n' "${LATEST_TAG:-<none>}"
	printf 'Root version: %s\n' "$ROOT_VERSION"
	printf 'Desktop version: %s\n' "$DESKTOP_VERSION"
	printf 'Tauri version: %s\n' "$TAURI_VERSION"
	printf 'Cargo version: %s\n' "$CARGO_VERSION"
	printf 'Worktree clean: %s\n' "$WORKTREE_CLEAN"
	printf 'Remote tag exists: %s\n' "$REMOTE_TAG_EXISTS"
	printf 'GitHub release exists: %s\n' "$RELEASE_EXISTS"
	printf '\n'

	if [[ "$ROOT_VERSION" == "$DESKTOP_VERSION" && "$ROOT_VERSION" == "$TAURI_VERSION" ]]; then
		green "Version alignment looks good for package.json and tauri.conf.json."
	else
		red "Version mismatch detected between root package.json, desktop package.json, and tauri.conf.json."
	fi

	if [[ "$ROOT_VERSION" == "$CARGO_VERSION" ]]; then
		green "Cargo version matches the app version."
	else
		yellow "Cargo.toml version differs from the app version. That may be intentional, but review it before release."
	fi

	if [[ "$WORKTREE_CLEAN" == "yes" ]]; then
		green "Git worktree is clean."
	else
		red "Git worktree is dirty. Tagging now would not include uncommitted changes."
	fi

	if [[ "$RELEASE_EXISTS" == "yes" ]]; then
		if grep -q "0.0.97" <<<"$RELEASE_SUMMARY"; then
			red "Existing GitHub release for v$CURRENT_VERSION contains stale 0.0.97 metadata/assets."
		else
			green "Existing GitHub release metadata looks version-aligned."
		fi
	fi

	for tool in git gh bun python3 docker; do
		if command_exists "$tool"; then
			green "Tool available: $tool"
		else
			yellow "Tool missing: $tool"
		fi
	done

	if gh auth status >/dev/null 2>&1; then
		green "GitHub CLI is authenticated."
	else
		red "GitHub CLI is not authenticated."
	fi
}

confirm() {
	local prompt="$1"
	local answer
	read -r -p "$prompt [y/N] " answer
	[[ "$answer" == "y" || "$answer" == "Y" ]]
}

create_local_tag() {
	refresh_state
	if [[ "$WORKTREE_CLEAN" != "yes" ]]; then
		red "Refusing to tag: the worktree is dirty."
		return 1
	fi

	if git rev-parse "v$CURRENT_VERSION" >/dev/null 2>&1; then
		yellow "Tag v$CURRENT_VERSION already exists locally."
		return 0
	fi

	git tag -a "v$CURRENT_VERSION" -m "Release v$CURRENT_VERSION"
	green "Created local tag v$CURRENT_VERSION"
}

push_tag() {
	refresh_state
	if ! git rev-parse "v$CURRENT_VERSION" >/dev/null 2>&1; then
		red "Tag v$CURRENT_VERSION does not exist locally yet."
		return 1
	fi

	git push origin "v$CURRENT_VERSION"
	green "Pushed v$CURRENT_VERSION"
}

create_github_release() {
	refresh_state
	local notes_file
	notes_file="$(write_release_notes_file)"

	if ! git ls-remote --tags origin "refs/tags/v$CURRENT_VERSION" | grep -q .; then
		red "Remote tag v$CURRENT_VERSION does not exist yet. Push the tag first."
		return 1
	fi

	if gh release view "v$CURRENT_VERSION" >/dev/null 2>&1; then
		yellow "GitHub release v$CURRENT_VERSION already exists."
		return 0
	fi

	gh release create "v$CURRENT_VERSION" \
		--title "Dora v$CURRENT_VERSION" \
		--notes-file "$notes_file"
	green "Created GitHub release v$CURRENT_VERSION"
}

repair_github_release_metadata() {
	refresh_state
	local notes_file
	notes_file="$(write_release_notes_file)"

	if [[ "$RELEASE_EXISTS" != "yes" ]]; then
		red "GitHub release v$CURRENT_VERSION does not exist."
		return 1
	fi

	gh release edit "v$CURRENT_VERSION" \
		--title "Dora v$CURRENT_VERSION" \
		--notes-file "$notes_file"
	green "Updated GitHub release title and notes for v$CURRENT_VERSION"
}

show_packaging_next_steps() {
	refresh_state
	local version="$CURRENT_VERSION"
	cat <<EOF
Next commands after the GitHub release is live:

Winget from a Windows VM:
  winget install wingetcreate
  wingetcreate new "https://github.com/remcostoeten/dora/releases/download/v$version/Dora_${version}_x64_en-US.msi"

AUR on this machine:
  bun run release:aur -- --version=$version --checksums-file=apps/desktop/src-tauri/target/release/bundle/checksums-linux.txt --appimage-file=Dora_${version}_amd64.AppImage
  bash tools/scripts/test-aur-docker.sh

Snap on Ubuntu:
  sudo snap install snapcraft --classic
  snapcraft --destructive-mode
EOF
}

main_menu() {
	refresh_state

	while true; do
		printf '\n'
		blue "Dora Release Guide"
		printf '1. Show readiness report\n'
		printf '2. Generate release notes draft\n'
		printf '3. Create local tag\n'
		printf '4. Push tag to origin\n'
		printf '5. Create GitHub release\n'
		printf '6. Repair existing GitHub release metadata\n'
		printf '7. Show package-manager next steps\n'
		printf '8. Exit\n'
		printf 'Choice: '

		read -r choice
		case "$choice" in
			1)
				show_readiness
				;;
			2)
				printf 'Release notes draft: %s\n' "$(write_release_notes_file)"
				;;
			3)
				if confirm "Create local tag v$CURRENT_VERSION?"; then
					create_local_tag
				fi
				;;
			4)
				if confirm "Push tag v$CURRENT_VERSION to origin?"; then
					push_tag
				fi
				;;
			5)
				if confirm "Create GitHub release v$CURRENT_VERSION now?"; then
					create_github_release
				fi
				;;
			6)
				if confirm "Repair the existing GitHub release title/notes for v$CURRENT_VERSION?"; then
					repair_github_release_metadata
				fi
				;;
			7)
				show_packaging_next_steps
				;;
			8)
				exit 0
				;;
			*)
				yellow "Unknown choice."
				;;
		esac
	done
}

cd "$ROOT_DIR"
main_menu

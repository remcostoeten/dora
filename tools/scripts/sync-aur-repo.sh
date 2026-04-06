#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$ROOT_DIR/packaging/aur"
TARGET_DIR="${1:-}"

if [[ -z "$TARGET_DIR" ]]; then
  echo "Usage: $0 /path/to/dora-bin-aur-checkout" >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  echo "Target is not a git checkout: $TARGET_DIR" >&2
  exit 1
fi

install -m 0644 "$SOURCE_DIR/PKGBUILD" "$TARGET_DIR/PKGBUILD"
install -m 0644 "$SOURCE_DIR/.SRCINFO" "$TARGET_DIR/.SRCINFO"

echo "Synced AUR package files into $TARGET_DIR"

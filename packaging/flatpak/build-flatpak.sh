#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_ID="io.github.remcostoeten.dora"
MANIFEST="$REPO_ROOT/packaging/flatpak/${APP_ID}.yml"
BUILD_DIR="$REPO_ROOT/.flatpak-build"
REPO_DIR="$REPO_ROOT/.flatpak-repo"
BUNDLE="$REPO_ROOT/dora.flatpak"

for cmd in flatpak flatpak-builder; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

echo "==> Ensuring Flatpak runtimes are installed..."
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive --assumeyes \
  org.gnome.Platform//48 \
  org.gnome.Sdk//48 \
  org.freedesktop.Sdk.Extension.rust-stable//24.08

echo "==> Building Dora with flatpak-builder..."
flatpak-builder \
  --force-clean \
  --ccache \
  --repo="$REPO_DIR" \
  "$BUILD_DIR" \
  "$MANIFEST"

echo "==> Creating single-file bundle..."
flatpak build-bundle \
  "$REPO_DIR" \
  "$BUNDLE" \
  "$APP_ID"

echo "==> Done!"
echo "Bundle: $BUNDLE"
echo ""
echo "Install with: flatpak install --user dora.flatpak"
echo "Or from repo: flatpak --user remote-add --no-gpg-verify dora-repo $REPO_DIR"
echo "             flatpak --user install dora-repo $APP_ID"

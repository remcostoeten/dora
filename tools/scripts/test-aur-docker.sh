#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PACKAGE_DIR="${1:-$ROOT_DIR/packaging/aur}"

if [[ ! -f "$PACKAGE_DIR/PKGBUILD" ]]; then
  echo "PKGBUILD not found at $PACKAGE_DIR" >&2
  exit 1
fi

docker run --rm \
  -v "$PACKAGE_DIR:/pkg" \
  archlinux:latest \
  bash -lc '
    set -euo pipefail
    pacman -Syu --noconfirm
    pacman -S --noconfirm base-devel git sudo
    useradd -m builder
    chown -R builder:builder /pkg
    printf "builder ALL=(ALL) NOPASSWD: ALL\n" > /etc/sudoers.d/builder
    su builder -c "cd /pkg && makepkg --syncdeps --noconfirm --cleanbuild --force"
  '

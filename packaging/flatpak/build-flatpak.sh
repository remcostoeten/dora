#!/usr/bin/env bash
# Builds the Dora Flatpak from a released .deb.
#
# usage: build-flatpak.sh [deb] [version] [release-date] [out-dir]
#   With no arguments it downloads the host-arch .deb of the latest release.
#   Output: <out-dir>/repo (OSTree repo) and <out-dir>/Dora-<version>-<arch>.flatpak
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_id="io.github.remcostoeten.dora"
runtime_version="51"

case "$(uname -m)" in
  x86_64) arch="x86_64"; deb_arch="amd64" ;;
  aarch64 | arm64) arch="aarch64"; deb_arch="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

for cmd in flatpak flatpak-builder; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Missing required command: $cmd" >&2; exit 1; }
done

deb="${1:-}"
version="${2:-}"
release_date="${3:-$(date -u +%Y-%m-%d)}"
out_dir="$(mkdir -p "${4:-$here/../../.flatpak-out}" && cd "${4:-$here/../../.flatpak-out}" && pwd)"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ -z "$deb" ]]; then
  tag="$(gh release view --repo remcostoeten/dora --json tagName --jq .tagName)"
  version="${tag#v}"
  gh release download "$tag" --repo remcostoeten/dora --pattern "Dora_${version}_${deb_arch}.deb" --dir "$work"
  deb="$work/Dora_${version}_${deb_arch}.deb"
fi
if [[ -z "$version" ]]; then
  version="$(basename "$deb" | sed -E 's/^Dora_([^_]+)_.*/\1/')"
fi

cp "$deb" "$work/dora.deb"
cp "$here/${app_id}.yml" "$here/${app_id}.desktop" "$work/"
sed -e "s|@VERSION@|${version}|g" -e "s|@DATE@|${release_date}|g" \
  "$here/${app_id}.metainfo.xml" > "$work/${app_id}.metainfo.xml"

flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive --assumeyes flathub \
  "org.gnome.Platform//${runtime_version}" "org.gnome.Sdk//${runtime_version}"

(
  cd "$work"
  flatpak-builder --user --force-clean --disable-rofiles-fuse \
    --default-branch=stable --subject="Dora ${version}" \
    --repo="${out_dir}/repo" build "${app_id}.yml"

  missing="$(flatpak build build sh -c 'ldd /app/bin/dora /app/bin/duckdb_helper | grep "not found" || true')"
  if [[ -n "$missing" ]]; then
    echo "Unresolved libraries inside the runtime:" >&2
    echo "$missing" >&2
    exit 1
  fi
)

bundle="${out_dir}/Dora-${version}-${arch}.flatpak"
flatpak build-bundle --arch="$arch" \
  --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo \
  "${out_dir}/repo" "$bundle" "$app_id" stable

echo "Bundle: $bundle"
echo "Install with: flatpak install --user $bundle"

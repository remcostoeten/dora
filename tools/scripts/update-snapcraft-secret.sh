#!/usr/bin/env bash
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-remcostoeten/dora}"
SECRET_NAME="${SNAP_SECRET_NAME:-SNAPCRAFT_STORE_CREDENTIALS}"
TMP_FILE="$(mktemp)"

cleanup() {
	rm -f "$TMP_FILE"
}
trap cleanup EXIT

if ! command -v snapcraft >/dev/null 2>&1; then
	echo "snapcraft is not installed or not on PATH." >&2
	exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
	echo "gh is not installed or not on PATH." >&2
	exit 1
fi

echo "Exporting fresh Snapcraft credentials for 'dora'..."
snapcraft export-login --snaps=dora \
	--acls package_access,package_push,package_update,package_release \
	"$TMP_FILE"

echo "Updating GitHub secret '$SECRET_NAME' in '$REPO'..."
gh secret set "$SECRET_NAME" --repo "$REPO" < "$TMP_FILE"

echo "Done. '$SECRET_NAME' was updated for '$REPO'."

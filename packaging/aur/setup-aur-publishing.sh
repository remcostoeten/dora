#!/usr/bin/env bash
set -euo pipefail

# One-shot helper to bootstrap AUR publishing for dora from ~/dev/dora.
# It can:
# - validate repo/workflow files exist
# - generate an SSH deploy key for AUR
# - optionally upload private key to GitHub secret AUR_SSH_PRIVATE_KEY (via gh CLI)
# - clone/sync local AUR repo checkout
# - optionally create and push a release tag

REPO_DIR="${REPO_DIR:-$HOME/dev/dora}"
AUR_PKG="dora"
AUR_REPO_SSH="ssh://aur@aur.archlinux.org/${AUR_PKG}.git"
KEY_PATH_DEFAULT="$HOME/.ssh/dora_aur_ed25519"

say() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
ask() { read -r -p "$1 [y/N] " ans; [[ "${ans:-}" =~ ^[Yy]$ ]]; }

ensure_clean_release_branch() {
  if ! git symbolic-ref -q HEAD >/dev/null; then
    echo "Refusing to tag from a detached HEAD." >&2
    exit 1
  fi

  local branch upstream local_head upstream_head
  branch="$(git branch --show-current)"
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "Refusing to tag with uncommitted changes." >&2
    exit 1
  fi

  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    echo "Refusing to tag branch without an upstream: $branch" >&2
    exit 1
  fi

  git fetch origin "$branch" --tags
  local_head="$(git rev-parse HEAD)"
  upstream_head="$(git rev-parse "$upstream")"
  if [[ "$local_head" != "$upstream_head" ]]; then
    echo "Refusing to tag because $branch is not synced with $upstream." >&2
    exit 1
  fi
}

need_cmd git
need_cmd ssh-keygen

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Repo not found at: $REPO_DIR" >&2
  echo "Set REPO_DIR=/path/to/dora and retry." >&2
  exit 1
fi

cd "$REPO_DIR"

say "Validating required packaging/workflow files"
required=(
  "packaging/aur/PKGBUILD"
  "packaging/aur/.SRCINFO"
  "packaging/linux/dora.desktop"
  ".github/workflows/aur.yml"
  ".github/workflows/release.yml"
  "docs/distribution/release-guide.md"
)
for f in "${required[@]}"; do
  [[ -f "$f" ]] || { echo "Missing file: $f" >&2; exit 1; }
done

say "Generating AUR deploy key (if missing)"
KEY_PATH="${KEY_PATH:-$KEY_PATH_DEFAULT}"
if [[ -f "$KEY_PATH" ]]; then
  echo "Key already exists: $KEY_PATH"
else
  ssh-keygen -t ed25519 -C "github-actions-aur" -f "$KEY_PATH" -N ""
  echo "Created: $KEY_PATH and ${KEY_PATH}.pub"
fi

echo
echo "Add this PUBLIC key to your AUR account SSH keys (https://aur.archlinux.org/account/):"
echo "-----8<-----"
cat "${KEY_PATH}.pub"
echo "----->8-----"

if ask "Upload private key to GitHub secret AUR_SSH_PRIVATE_KEY using gh CLI?"; then
  need_cmd gh
  gh secret set AUR_SSH_PRIVATE_KEY < "$KEY_PATH"
  say "Secret AUR_SSH_PRIVATE_KEY uploaded"
else
  say "Skipped secret upload. Add it manually in GitHub repo settings."
fi

echo
echo "Set GitHub secret AUR_KNOWN_HOSTS to a pinned aur.archlinux.org SSH known_hosts entry."
echo "The AUR workflow refuses to publish without it."

if ask "Clone local AUR repo checkout into a new temp directory?"; then
  need_cmd ssh
  AUR_WORKDIR="$(mktemp -d -t "${AUR_PKG}-aur.XXXXXX")"
  echo "Using temp checkout: ${AUR_WORKDIR}"
  GIT_SSH_COMMAND="ssh -i ${KEY_PATH} -o IdentitiesOnly=yes" \
    git clone "$AUR_REPO_SSH" "$AUR_WORKDIR"
  cp packaging/aur/PKGBUILD "$AUR_WORKDIR/PKGBUILD"
  cp packaging/aur/.SRCINFO "$AUR_WORKDIR/.SRCINFO"
  say "Prepared ${AUR_WORKDIR} with current packaging files"
fi

if ask "Create and push a new git tag to trigger release + AUR automation now?"; then
  ensure_clean_release_branch
  CUR_VER="$(sed -n 's/^pkgver=//p' packaging/aur/PKGBUILD)"
  echo "Current pkgver in PKGBUILD: ${CUR_VER}"
  read -r -p "Enter tag (example v0.0.104): " TAG
  if [[ -z "${TAG:-}" ]]; then
    echo "No tag entered; skipping."
  else
    git fetch --tags
    if git rev-parse "$TAG" >/dev/null 2>&1; then
      echo "Tag already exists locally: $TAG" >&2
      exit 1
    fi
    git tag "$TAG"
    git push origin "$TAG"
    say "Pushed tag $TAG"
  fi
fi

cat <<'TXT'

Done.
Next checks:
1) Verify GitHub Release includes dora-x86_64-unknown-linux-gnu.tar.gz
2) Verify AUR workflow run succeeded (.github/workflows/aur.yml)
3) On Arch: yay -S dora

TXT

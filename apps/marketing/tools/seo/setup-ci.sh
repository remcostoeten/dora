#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="$ROOT/.vercel/project.json"

if ! gh auth status >/dev/null 2>&1; then
    echo "GitHub CLI is not authenticated"
    exit 1
fi

if ! bunx vercel whoami >/dev/null 2>&1; then
    echo "Vercel CLI is not authenticated"
    exit 1
fi

if [ ! -f "$PROJECT" ]; then
    bunx vercel link --yes
fi

REPO="${GH_REPO:-remcostoeten/dora}"

if [ -z "$REPO" ] && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

if [ -z "$REPO" ]; then
    echo "Set GH_REPO=owner/repo"
    exit 1
fi

gh repo view "$REPO" >/dev/null

ORG_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT', 'utf8')).orgId)")"
PROJECT_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PROJECT', 'utf8')).projectId)")"

gh secret set VERCEL_ORG_ID --repo "$REPO" --body "$ORG_ID"
gh secret set VERCEL_PROJECT_ID --repo "$REPO" --body "$PROJECT_ID"

TOKEN="${VERCEL_TOKEN:-}"
AUTH="$HOME/.local/share/com.vercel.cli/auth.json"

if [ -z "$TOKEN" ] && [ -f "$AUTH" ]; then
    TOKEN="$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$AUTH', 'utf8')).token || '')")"
fi

if [ -n "$TOKEN" ]; then
    gh secret set VERCEL_TOKEN --repo "$REPO" --body "$TOKEN"
else
    echo "Set VERCEL_TOKEN manually or rerun with VERCEL_TOKEN=..."
fi

echo "Configured $REPO"

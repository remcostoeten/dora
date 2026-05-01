#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$(mktemp)"

ARGS=(vercel deploy --prod)

if [ -n "${VERCEL_TOKEN:-}" ]; then
    ARGS+=("--token=$VERCEL_TOKEN")
fi

bunx "${ARGS[@]}" 2>&1 | tee "$LOG"

URL="$(grep -Eo 'https://[^[:space:]]+' "$LOG" | tail -n 1 | sed 's/[),.;]$//')"

rm -f "$LOG"

if [ -z "$URL" ]; then
    echo "Failed to extract deployment URL"
    exit 1
fi

python3 "$ROOT/tools/seo/audit.py" "$URL"

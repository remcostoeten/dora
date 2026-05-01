#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

python3 "$ROOT/tools/seo/install.py"

if [ -x "$ROOT/.venv/bin/python" ]; then
    exec "$ROOT/.venv/bin/python" "$ROOT/tools/seo/audit.py" "$@"
fi

exec python3 "$ROOT/tools/seo/audit.py" "$@"

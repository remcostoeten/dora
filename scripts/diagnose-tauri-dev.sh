#!/usr/bin/env bash
# diagnose-tauri-dev.sh
# Launch `bun tauri:dev` with full diagnostics.
# Timestamps every line, captures stdout+stderr, flags milestones and panics.
#
# Usage: ./scripts/diagnose-tauri-dev.sh [--fresh]
#   --fresh : cargo clean before launch (forces full recompile)

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/desktop"
TAURI_DIR="$APP_DIR/src-tauri"
LOG_DIR="$REPO_ROOT/.tauri-logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/tauri-dev-$TS.log"

mkdir -p "$LOG_DIR"

# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────
c_reset='\033[0m'
c_dim='\033[2m'
c_bold='\033[1m'
c_red='\033[31m'
c_green='\033[32m'
c_yellow='\033[33m'
c_blue='\033[34m'
c_cyan='\033[36m'

stamp() {
    date +'%H:%M:%S.%3N'
}

log() {
    printf '%b[%s] %s%b\n' "$c_dim" "$(stamp)" "$1" "$c_reset" | tee -a "$LOG_FILE"
}

info()    { printf '%b[%s]%b %b→%b %s\n' "$c_dim" "$(stamp)" "$c_reset" "$c_cyan" "$c_reset" "$1" | tee -a "$LOG_FILE"; }
good()    { printf '%b[%s]%b %b✓%b %s\n' "$c_dim" "$(stamp)" "$c_reset" "$c_green" "$c_reset" "$1" | tee -a "$LOG_FILE"; }
warn()    { printf '%b[%s]%b %b!%b %s\n' "$c_dim" "$(stamp)" "$c_reset" "$c_yellow" "$c_reset" "$1" | tee -a "$LOG_FILE"; }
err()     { printf '%b[%s]%b %b✗%b %s\n' "$c_dim" "$(stamp)" "$c_reset" "$c_red" "$c_reset" "$1" | tee -a "$LOG_FILE"; }
section() { printf '\n%b━━ %s ━━%b\n' "$c_bold" "$1" "$c_reset" | tee -a "$LOG_FILE"; }

# ──────────────────────────────────────────────────────────────────
# Parse args
# ──────────────────────────────────────────────────────────────────
FRESH=false
for arg in "$@"; do
    case "$arg" in
        --fresh) FRESH=true ;;
        -h|--help)
            echo "Usage: $0 [--fresh]"
            echo "  --fresh   Run 'cargo clean' first (forces full recompile)"
            exit 0
            ;;
    esac
done

section "Environment"
info "Repo:       $REPO_ROOT"
info "App dir:    $APP_DIR"
info "Log file:   $LOG_FILE"
info "Platform:   $(uname -srm)"
info "Shell:      ${SHELL:-unknown}"
info "Working dir: $(pwd)"

# ──────────────────────────────────────────────────────────────────
# Pre-flight: tooling
# ──────────────────────────────────────────────────────────────────
section "Tooling"
for tool in bun cargo rustc node; do
    if command -v "$tool" >/dev/null 2>&1; then
        ver="$("$tool" --version 2>/dev/null | head -1)"
        good "$tool: $ver"
    else
        err "$tool: not found in PATH"
    fi
done

# Bun via ~/.bun/bin if not on PATH
if ! command -v bun >/dev/null 2>&1 && [[ -x "$HOME/.bun/bin/bun" ]]; then
    export PATH="$HOME/.bun/bin:$PATH"
    good "bun found via \$HOME/.bun/bin: $(bun --version)"
fi

# ──────────────────────────────────────────────────────────────────
# .env file check
# ──────────────────────────────────────────────────────────────────
section ".env"
ENV_FILE="$REPO_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
    good ".env exists at $ENV_FILE"
    KEY_COUNT=$(grep -cE '^GROQ_API_KEY(_[0-9]+)?=.+$' "$ENV_FILE" 2>/dev/null || echo 0)
    if [[ "$KEY_COUNT" -gt 0 ]]; then
        good "GROQ_API_KEY entries: $KEY_COUNT"
    else
        warn "No non-empty GROQ_API_KEY* entries in .env"
    fi
    # sanity-check for obviously empty values
    if grep -E '^GROQ_API_KEY[^=]*=\s*$' "$ENV_FILE" >/dev/null 2>&1; then
        warn ".env contains GROQ_API_KEY line(s) with empty value"
    fi
else
    warn ".env missing — Groq AI will not work. Copy .env.example → .env"
fi

# ──────────────────────────────────────────────────────────────────
# Port 1420 check (vite)
# ──────────────────────────────────────────────────────────────────
section "Ports"
if command -v ss >/dev/null 2>&1; then
    if ss -lnt 2>/dev/null | awk '{print $4}' | grep -q ':1420$'; then
        err "Port 1420 already in use — vite --strictPort will fail"
        ss -lnt 2>/dev/null | grep ':1420' | tee -a "$LOG_FILE"
    else
        good "Port 1420 free"
    fi
elif command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:1420 -sTCP:LISTEN >/dev/null 2>&1; then
        err "Port 1420 already in use"
    else
        good "Port 1420 free"
    fi
else
    warn "No ss or lsof — cannot verify port 1420"
fi

# ──────────────────────────────────────────────────────────────────
# Existing tauri/cargo processes
# ──────────────────────────────────────────────────────────────────
section "Existing processes"
STALE=$(pgrep -fa 'tauri dev|cargo run|vite --port 1420|app-lib' 2>/dev/null || true)
if [[ -n "$STALE" ]]; then
    warn "Found running processes that may conflict:"
    printf '%s\n' "$STALE" | tee -a "$LOG_FILE"
    warn "Kill them first with: pkill -f 'tauri dev|cargo run|vite --port 1420'"
else
    good "No stale tauri/cargo/vite processes"
fi

# ──────────────────────────────────────────────────────────────────
# Fresh rebuild
# ──────────────────────────────────────────────────────────────────
if [[ "$FRESH" == true ]]; then
    section "cargo clean (--fresh)"
    ( cd "$TAURI_DIR" && cargo clean 2>&1 | tee -a "$LOG_FILE" )
fi

# ──────────────────────────────────────────────────────────────────
# Pre-compile check so we know Rust compiles before launching tauri
# ──────────────────────────────────────────────────────────────────
section "cargo check (pre-flight)"
info "Running cargo check to catch compile errors before tauri-dev launches..."
if ( cd "$TAURI_DIR" && cargo check 2>&1 | tee -a "$LOG_FILE" | grep -E 'error\[|^error:' > /dev/null ); then
    err "cargo check found errors — aborting launch"
    err "Full output in: $LOG_FILE"
    exit 1
fi
good "cargo check passed"

# ──────────────────────────────────────────────────────────────────
# Launch tauri dev
# ──────────────────────────────────────────────────────────────────
section "Launching tauri dev"
info "Command: bun tauri:dev"
info "Env:     RUST_LOG=debug,app=trace RUST_BACKTRACE=1"
info "Watching for milestones: vite ready, cargo finished, window created, panic"
info "Press Ctrl+C to stop. Full log: $LOG_FILE"
echo "" | tee -a "$LOG_FILE"

export RUST_LOG="${RUST_LOG:-debug,app=trace,libsql=warn,sqlx=warn,tokio=info,hyper=info}"
export RUST_BACKTRACE="${RUST_BACKTRACE:-1}"

# Milestone grep patterns
MILESTONES='ROLLDOWN-VITE|Local:|Compiling app|Finished .*profile|app listening|window created|thread .* panicked|RUST_BACKTRACE|LLVM ERROR|cannot find|not found in PATH|Address already in use|Permission denied'

cd "$APP_DIR"

# Stream through awk to prefix timestamps, tee into log file, still exit on Ctrl+C
# shellcheck disable=SC2094
{
    bun tauri:dev 2>&1 &
    CHILD_PID=$!
    echo "$CHILD_PID" > "$LOG_DIR/.last-pid"
    # Forward SIGINT / SIGTERM to child
    trap 'kill -INT "$CHILD_PID" 2>/dev/null; wait "$CHILD_PID" 2>/dev/null; exit 130' INT TERM
    wait "$CHILD_PID"
    EXIT_CODE=$?
    echo "__TAURI_DEV_EXIT_CODE=$EXIT_CODE"
} | while IFS= read -r line; do
    ts="$(stamp)"
    if [[ "$line" == __TAURI_DEV_EXIT_CODE=* ]]; then
        code="${line#__TAURI_DEV_EXIT_CODE=}"
        if [[ "$code" == "0" ]]; then
            good "tauri dev exited cleanly (code 0)"
        else
            err "tauri dev exited with code $code"
        fi
        echo "[$ts] EXIT $code" >> "$LOG_FILE"
        continue
    fi

    # Flag milestones with colour
    if echo "$line" | grep -qE "$MILESTONES"; then
        if echo "$line" | grep -qE "panic|LLVM ERROR|error\[|^error:"; then
            printf '%b[%s] ✗ %s%b\n' "$c_red" "$ts" "$line" "$c_reset"
        elif echo "$line" | grep -qE "Finished .*profile|window created|app listening"; then
            printf '%b[%s] ✓ %s%b\n' "$c_green" "$ts" "$line" "$c_reset"
        else
            printf '%b[%s] → %s%b\n' "$c_cyan" "$ts" "$line" "$c_reset"
        fi
    else
        printf '%b[%s]%b %s\n' "$c_dim" "$ts" "$c_reset" "$line"
    fi
    echo "[$ts] $line" >> "$LOG_FILE"
done

# ──────────────────────────────────────────────────────────────────
# Post-run summary
# ──────────────────────────────────────────────────────────────────
section "Summary"
info "Full log: $LOG_FILE"
if grep -qE 'thread .* panicked|RUST_BACKTRACE|LLVM ERROR' "$LOG_FILE"; then
    err "Panic or fatal error detected. Grep for 'panic' or 'error' in log:"
    err "  grep -nE 'panic|error\\[|^error:' $LOG_FILE"
fi
if grep -q 'Finished .*profile' "$LOG_FILE"; then
    good "cargo compile finished — if no window appeared, the app binary crashed on launch"
fi
if grep -qE 'Address already in use' "$LOG_FILE"; then
    err "Port conflict — another process is holding 1420"
fi

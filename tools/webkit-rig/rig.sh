#!/usr/bin/env bash
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WIDTH=${RIG_W:-2560}
HEIGHT=${RIG_H:-1440}
INSPECTOR_PORT=${INSPECTOR_PORT:-9333}

usage() {
	sed -n '/^## Commands/,/^## Reading/p' "$HERE/README.md" | sed '$d'
}

renderer_env() {
	case "${RIG_MODE:-software}" in
	software) echo "GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1" ;;
	gpu) echo "GDK_BACKEND=x11 WEBKIT_DMABUF_RENDERER_FORCE_SHM=1" ;;
	wayland) echo "GDK_BACKEND=wayland __NV_DISABLE_EXPLICIT_SYNC=1" ;;
	*)
		echo "RIG_MODE must be software, gpu or wayland" >&2
		exit 2
		;;
	esac
}

page_url() {
	echo "${1%/}/?view=database-studio&connection=perf-conn-00&perf=1"
}

run_scenario() {
	local base=$1 scenario=$2
	# shellcheck disable=SC2046
	env $(renderer_env) python3 "$HERE/run_scenario.py" "$(page_url "$base")" "$WIDTH" "$HEIGHT" \
		"${RIG_SCENARIO:-$HERE/scenarios/$scenario.js}" 2>&1
}

command=${1:-help}
shift || true

case "$command" in
build)
	(cd "$REPO/apps/desktop" && bunx vite build && bunx vite build --config vite.profile.config.ts)
	;;
serve)
	exec python3 "$HERE/serve.py" "$1" "$2"
	;;
measure)
	RIG_ONLY="${2:-}" run_scenario "$1" measure | python3 "$HERE/report.py" measure
	;;
attrib)
	RIG_ATTRIB=1 RIG_ONLY="${2:-}" run_scenario "$1" attrib | python3 "$HERE/report.py" attrib
	;;
layout)
	RIG_LAYOUT=1 run_scenario "$1" layout | python3 "$HERE/report.py" layout
	;;
wheel)
	# shellcheck disable=SC2046
	env $(renderer_env) python3 "$HERE/wheel.py" "$(page_url "$1")" "$WIDTH" "$HEIGHT" 2>&1 |
		python3 "$HERE/report.py" plain
	;;
timeline)
	# shellcheck disable=SC2046
	env $(renderer_env) RIG_ONLY=150000 WEBKIT_INSPECTOR_HTTP_SERVER="127.0.0.1:$INSPECTOR_PORT" \
		python3 "$HERE/run_scenario.py" "$(page_url "$1")" "$WIDTH" "$HEIGHT" "$HERE/scenarios/hold.js" \
		>/dev/null 2>&1 &
	holder=$!
	for _ in $(seq 1 60); do
		curl -s -m 1 "http://127.0.0.1:$INSPECTOR_PORT/" | grep -q "socket/1/1/WebPage" && break
		sleep 0.3
	done
	sleep 5
	INSPECTOR_PORT=$INSPECTOR_PORT bun "$HERE/timeline.mjs" "${2:-table}"
	kill "$holder" 2>/dev/null
	wait "$holder" 2>/dev/null
	;;
*)
	usage
	;;
esac

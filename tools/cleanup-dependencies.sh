#!/bin/bash
set -e

# Config
PROJECT_ROOT=$(pwd)
DESKTOP_DIR="$PROJECT_ROOT/apps/desktop"

# Unused packages identified by audit
UNUSED_PACKAGES=(
    "@radix-ui/react-accordion"
    "@radix-ui/react-aspect-ratio"
    "@radix-ui/react-avatar"
    "@radix-ui/react-hover-card"
    "@radix-ui/react-menubar"
    "@radix-ui/react-navigation-menu"
    "@radix-ui/react-progress"
    "@radix-ui/react-radio-group"
    "@radix-ui/react-toggle"
    "@radix-ui/react-toggle-group"
    "cmdk"
    "embla-carousel-react"
    "react-day-picker"
    "vaul"
    "zod"
    "react-hook-form"
    "recharts"
    "input-otp"
)

echo "🔍 Dependency Cleanup"
echo "Target: $DESKTOP_DIR"
echo "Removing ${#UNUSED_PACKAGES[@]} unused packages..."

cd "$DESKTOP_DIR"

# Construct removal command
CMD="bun remove"
for pkg in "${UNUSED_PACKAGES[@]}"; do
    CMD="$CMD $pkg"
done

echo "Running: $CMD"
$CMD

echo "✅ Cleanup complete. Please run 'bun run build' to verify."

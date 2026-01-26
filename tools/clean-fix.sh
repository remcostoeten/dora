#!/bin/bash
set -e

# Define root directory
ROOT_DIR=$(pwd)

echo "🧹 Cleaning up project from $ROOT_DIR..."

# Remove root node_modules and .turbo
rm -rf "$ROOT_DIR/node_modules" "$ROOT_DIR/.turbo"

# Find and remove items in subdirectories
find "$ROOT_DIR/apps" "$ROOT_DIR/packages" -type d \( -name "node_modules" -o -name ".next" -o -name ".turbo" -o -name "dist" -o -name ".vite" \) -prune -exec rm -rf {} +

echo "✨ Clean complete."

echo "📦 Installing dependencies..."
bun install

echo "🏗️  Building project..."
bun run build

echo "✅ Done! Try running the dev server again."

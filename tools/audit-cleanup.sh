#!/bin/bash
set -e

# ==========================================
# CONFIGURATION
# ==========================================
BACKUP_ROOT="$HOME/.dora/backups/$(date +%Y%m%d_%H%M%S)"
PROJECT_ROOT=$(pwd)
DRY_RUN=true

# ==========================================
# UNUSED FILES DEFINITION
# ==========================================
# Define path relative to project root
FILES_TO_REMOVE=(
    # Feature: Database Studio
    "apps/desktop/src/features/database-studio/utils/get-column-icon.tsx"

    # Feature: Docker Manager
    "apps/desktop/src/features/docker-manager/hooks/use-container-history.ts"
    "apps/desktop/src/features/docker-manager/hooks/use-container-sort-filter.ts"

    # Feature: SQL Console
    "apps/desktop/src/features/sql-console/components/query-sidebar.tsx"
    "apps/desktop/src/features/sql-console/components/schema-browser.tsx"

    # Feature: Sidebar / General
    "apps/desktop/src/features/sidebar/components/theme-panel.tsx"
    "apps/desktop/src/features/sidebar/components/spotlight-trigger.tsx"
    "apps/desktop/src/features/sidebar/components/nav-buttons.tsx"

    # Round 2: Comprehensive Scan Findings
    "apps/desktop/src/hooks/use-github-release.ts"
    "apps/desktop/src/hooks/use-horizontal-scroll.ts"
    "apps/desktop/src/features/docker-manager/api/queries/use-container-sizes.ts"
)

# ==========================================
# ARGUMENT PARSING
# ==========================================
for arg in "$@"; do
    case $arg in
        --execute)
        DRY_RUN=false
        shift
        ;;
        --force)
        FORCE=true
        shift
        ;;
        --help)
        echo "Usage: ./tools/audit-cleanup.sh [--execute] [--force]"
        echo "  --execute  Perform actual backup and deletion (default is DRY RUN)"
        echo "  --force    Bypass Pre-flight Git checks"
        exit 0
        ;;
    esac
done

# ==========================================
# PRE-FLIGHT CHECKS
# ==========================================
echo "🔍 Starting Project Audit Cleanup..."

if [ "$DRY_RUN" = false ]; then
    echo "⚠️  EXECUTION MODE ENABLED"
    
    # Git Safety Check
    if [ "$FORCE" = true ]; then
        echo "⚠️  Skipping Git Safety Check (--force used)"
    elif ! git diff-index --quiet HEAD --; then
        echo "❌ Error: You have uncommitted changes."
        echo "   Please commit your changes before running cleanup."
        exit 1
    fi
    echo "✅ Git is clean."

    # Reminder to push (optional, hard to enforce strictly if no upstream, but good practice)
    echo "ℹ️  Reminder: Ensure you have pushed your latest changes to origin."
    echo "   Press ENTER to continue or Ctrl+C to abort."
    read -r
else
    echo "ℹ️  DRY RUN MODE (No changes will be made)"
    echo "   Use --execute to perform deletion."
fi

# ==========================================
# EXECUTION LOOP
# ==========================================
echo "📋 Processing ${#FILES_TO_REMOVE[@]} files..."

for FILE_PATH in "${FILES_TO_REMOVE[@]}"; do
    FULL_PATH="$PROJECT_ROOT/$FILE_PATH"

    if [ ! -f "$FULL_PATH" ]; then
        echo "⚠️  File not found (already deleted?): $FILE_PATH"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "   [DRY-RUN] Would delete: $FILE_PATH"
    else
        # Backup Logic
        BACKUP_DEST="$BACKUP_ROOT/$FILE_PATH"
        mkdir -p "$(dirname "$BACKUP_DEST")"
        cp "$FULL_PATH" "$BACKUP_DEST"
        
        # Delete Logic
        rm "$FULL_PATH"
        echo "   ✅ Moved to backup & deleted: $FILE_PATH"
    fi
done

if [ "$DRY_RUN" = false ]; then
    echo "✨ Cleanup complete."
    echo "📦 Backups saved to: $BACKUP_ROOT"
    
    echo "🏗️  Verifying build..."
    bun run build || { echo "❌ Build failed! Restore from backup immediately."; exit 1; }
    echo "✅ Build passed!"
else
    echo "🏁 Dry run complete."
fi

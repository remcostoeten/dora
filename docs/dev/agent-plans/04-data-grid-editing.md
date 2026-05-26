# Data Grid Editing Plan

## Goal

Centralize the data-grid edit flow so keyboard, blur, and selection changes all behave the same way, and remove leftover debug noise.

## Problems To Fix

- Edit commit logic is duplicated across entry paths.
- Keyboard and blur commits can drift apart over time.
- Selection state and editing state can get out of sync.
- Debug logging still exists in production paths.
- The grid edit lifecycle should be easier to understand and test.

## Scope

Primary files:

- `apps/desktop/src/features/database-studio/components/data-grid/use-cell-editing.ts`
- `apps/desktop/src/features/database-studio/components/data-grid/grid-body.tsx`

Secondary files if needed:

- `apps/desktop/src/features/database-studio/components/data-grid.tsx`
- `apps/desktop/src/features/database-studio/components/data-grid/use-grid-keyboard.ts`
- `apps/desktop/src/features/database-studio/components/data-grid/use-cell-selection.ts`

## Implementation Plan

1. Keep a single commit function for blur, Enter, and Tab navigation.
2. Make the commit function responsible for clearing or preserving edit state in one place.
3. Ensure selection moves and focus moves happen after the edit lifecycle is finalized.
4. Remove production debug logs from the grid body and related event handlers.
5. Verify that a canceled edit does not leave stale edit refs behind.
6. Check whether selection updates need a stronger guard when the grid re-renders during an edit.
7. Keep the hook API simple enough that future edit behavior can be tested in isolation.

## Acceptance Criteria

- Blur, Enter, and Tab all commit through the same path.
- Canceling an edit leaves no stale edit state.
- The grid has no production debug logging.
- Selection and focus remain in sync during keyboard navigation.

## Verification

- Edit a cell, press Enter, blur, and Tab through the same cell path.
- Cancel editing and confirm the grid returns to the prior state cleanly.
- Search for leftover grid debug logging.
- Run `bun x tsc -p apps/desktop/tsconfig.app.json --noEmit --ignoreDeprecations 6.0`.
- Run `bun run --cwd apps/desktop build`.

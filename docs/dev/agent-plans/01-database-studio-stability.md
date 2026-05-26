# Database Studio Stability Plan

## Goal

Make table switching, table loading, and data refresh in `DatabaseStudio` deterministic under fast user interaction and background updates.

## Problems To Fix

- Stale async responses can overwrite newer table state.
- Table cache, schema fetch, and row fetch are not coordinated tightly enough.
- Loading state can linger or clear too early when requests overlap.
- Live monitoring and manual refreshes can race with selection changes.
- The file is carrying too many responsibilities, so regressions are easy to reintroduce.

## Scope

Primary file:

- `apps/desktop/src/features/database-studio/database-studio.tsx`

Secondary files if needed:

- `apps/desktop/src/core/data-provider/hooks.ts`
- `apps/desktop/src/core/live-monitor/live-monitor-context.tsx`
- `apps/desktop/src/shared/utils/table-ref.ts`

## Implementation Plan

1. Audit every entry point that loads table data.
2. Add a request token or monotonic load id that is checked before every state write.
3. Apply cached table data immediately when available, but only if it matches the current selection.
4. Separate schema validation from row loading so a slow schema call cannot block the correct table from rendering cached data.
5. Ensure only the latest in-flight request is allowed to clear `isLoading`.
6. Make refresh paths reuse the same guarded loader instead of duplicating fetch logic.
7. If live monitoring is triggering broad reloads, narrow it to the active table or queue a single reload per tick.
8. Keep error handling user-visible and consistent with the notifier system.

## Acceptance Criteria

- Fast table switching never shows rows from the wrong table.
- A stale response cannot overwrite the current selection.
- Loading state is correct after rapid tab or sidebar changes.
- Cache renders quickly without flashing an unrelated table.
- Manual refresh and live updates do not fight each other.

## Verification

- Reproduce fast table switching and verify the final table stays correct.
- Reproduce a slow schema/load response and confirm a newer selection wins.
- Run `bun x tsc -p apps/desktop/tsconfig.app.json --noEmit --ignoreDeprecations 6.0`.
- Run `bun run --cwd apps/desktop build`.


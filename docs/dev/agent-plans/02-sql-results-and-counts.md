# SQL Results And Counts Plan

## Goal

Finish the SQL console result editing path so it behaves consistently with the main data grid, and make async row counts safe and predictable.

## Problems To Fix

- SQL result editing is still partially separate from the table viewer editing flow.
- Unchanged edits can still feel ambiguous unless they are guarded everywhere.
- Save, blur, and Enter behavior must commit exactly once.
- Row count queries must not interpolate raw table identifiers.
- Count queries can still be expensive on large tables, so the UX needs a clear fallback path.

## Scope

Primary files:

- `apps/desktop/src/features/sql-console/components/sql-results.tsx`
- `apps/desktop/src/features/sql-console/hooks/use-async-row-count.ts`

Secondary files if needed:

- `apps/desktop/src/shared/utils/table-ref.ts`
- `apps/desktop/src/core/data-provider/hooks.ts`
- `apps/desktop/src/features/sql-console/sql-console.tsx`

## Implementation Plan

1. Make SQL result edits share the same no-op comparison and value normalization rules as the table viewer.
2. Ensure blur, Enter, and explicit submit all route through one commit path.
3. Prevent double-submit during a single edit session.
4. Keep errors visible through the notifier, but do not fire success messages for no-op or canceled edits.
5. Review whether row editing needs better null handling, primary-key messaging, or rollback behavior.
6. Replace any raw table name interpolation in count queries with dialect-aware identifier quoting.
7. Preserve schema-qualified identifiers and quoted names correctly.
8. Cache or infer the current adapter dialect so the count query formatter stays cheap.
9. Decide on a fallback for large-table counts, such as estimated counts, a timeout, or an explicit opt-out.

## Acceptance Criteria

- Clicking a cell and blurring without changing anything does not send an update.
- Editing a result cell commits once, not twice.
- Count queries are identifier-safe across supported providers.
- Count loading remains non-blocking and does not freeze the console.
- Errors are reported clearly and consistently.

## Verification

- Edit a value and blur, then confirm only one mutation fires.
- Focus and blur without editing, then confirm no toast and no mutation.
- Test a schema-qualified table name in the count path.
- Run `bun x tsc -p apps/desktop/tsconfig.app.json --noEmit --ignoreDeprecations 6.0`.
- Run `bun run --cwd apps/desktop build`.


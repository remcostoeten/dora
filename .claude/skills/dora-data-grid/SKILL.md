---
name: dora-data-grid
description: Rendering the browse table. Use when changing how a cell value is displayed or edited, how a column is sized or sorted from the header, how rows and cells are selected or focused, how the grid responds to the keyboard or the clipboard, when virtualization engages, how the draft-insert row behaves, or how a pending edit is marked on screen. Not for how rows are fetched, paged or cancelled (dora-query-pipeline) and not for the IPC surface (dora-tauri-boundary).
---

# Data grid

## Scope

This skill owns rendering: what a cell looks like, how it is edited in place,
how rows and cells are selected and focused, what the keyboard does inside the
grid, and when rows are virtualized.

It owns nothing that moves data. Fetching, paging, cancellation, staleness and
ownership of result state belong to `dora-query-pipeline`; the command surface
and payload shapes belong to `dora-tauri-boundary`. Nothing here restates either.

The component is `packages/studio/src/features/database-studio/components/data-grid.tsx`
with its parts under
`packages/studio/src/features/database-studio/components/data-grid/`. Its owner —
the thing that holds rows and performs mutations — is
`packages/studio/src/features/database-studio/database-studio.tsx`.

## Unencodable

Source has two or more answers and `.agent-skills/FINDINGS.md` declines to pick
one. Ask before deciding.

- Which virtualized table a new result surface should use. Three exist and the
  grid is only one of them (FINDINGS 4.11). Rules below describe this grid.
- Which state idiom a new grid-adjacent store should use (FINDINGS 4.8).
- Where a new test file goes (FINDINGS 4.15).

## Workflow

Changing anything the grid draws:

1. Decide whether the change is rendering or data. If it needs a value the grid
   does not already have in props, it is data — add it in
   `database-studio.tsx` and pass it down. Do not reach out from inside the grid.
2. Put cell-shape logic in `formatCellValue`
   (`packages/studio/src/features/database-studio/components/data-grid/cell-value.tsx`)
   and interaction logic in the hook that already owns that interaction:
   `use-cell-editing.ts`, `use-cell-selection.ts`, `use-row-selection.ts`,
   `use-focused-cell.ts`, `use-column-resize.ts`, `use-grid-keyboard.ts`,
   `use-row-virtualizer.ts`. A new `useState` in `data-grid.tsx` usually means
   the hook was missed.
3. New user intent leaves as a callback prop, added to both the `Props` type in
   `data-grid.tsx` and the pass-through in
   `packages/studio/src/features/database-studio/components/data-grid/grid-body.tsx`.
4. Anything that writes to the database is handled in `database-studio.tsx`,
   keyed by primary key, and refuses when there is no primary key.
5. Keep the decision logic in an exported pure function where the interaction
   allows it — `parseClipboardGrid`, `getCellsInRectangle`,
   `normalizeValueForInsert` and `overlayPendingEditsOnRows` are the shape to
   copy, and the ones that already carry tests.

## Invariants

**The grid fetches nothing.** No file under
`packages/studio/src/features/database-studio/components/data-grid/` imports the
adapter, the bindings or a query hook, and `data-grid.tsx` imports none either.
Values arrive as props, intent leaves as callbacks. The only global it reads is
`useSettings` for `privacyMaskData`, and the only browser API it reaches for is
the clipboard. Every database read or write — including binary cell bytes, which
`handleBlobAction` in `database-studio.tsx` performs — happens in the owner.
Whether such a call is allowed to be issued at all, and what happens to it in
flight, is `dora-query-pipeline`'s.

**The grid does not decide whether it is editable.** An omitted `onCellEdit`,
`onBatchCellEdit`, `onDeleteSelectedRows` or `onRowAction` is how the owner
expresses read-only, and every call site null-checks the callback. Never add an
internal editability test; add a prop the owner controls.

**Row identity is the array index for a paint and the primary key for anything
else.** Inside one rendered result a row is its index in `rows`: that is the
React key, the `data-cell-key` prefix, the member of `selectedRows`, and the
argument every grid callback carries. The moment a value leaves the grid it must
be re-addressed by the primary-key column — `primaryKeyColumnName` in
`data-grid.tsx` is `columns.find(c => c.primaryKey)?.name`, the first declared
key, and composite keys are not supported by that path.

**A table with no primary key renders but cannot be mutated.** It scrolls,
selects, focuses, sorts and copies exactly like any other. Every data-moving
callback refuses through `notifyMissingPrimaryKey` instead of guessing, and the
dirty marker silently never paints because `isDirty` needs
`primaryKeyColumnName`. Do not fall back to a rowid, to a column named `id`, or
to the row index — `resolveMutationPrimaryKey` in
`packages/studio/src/features/sql-console/mutation-primary-key.ts` states why the
`id` heuristic turns one cell edit into an update of every matching row.

**Virtualization engages strictly above 100 rows.** `VIRTUALIZE_THRESHOLD` in
`data-grid.tsx` gates `useRowVirtualizer`; at or below it `virtualRows` is null,
both spacer rows have zero height, and every row is in the DOM. Above it,
`grid-body.tsx` renders only the windowed indexes between a top and a bottom
spacer `<tr>`. Mounted rows are measured through `measureElement`, so expanded
JSON and other variable-height content updates scroll math. When keyboard focus
moves outside the mounted window, the grid first calls `scrollToIndex`, then
focuses the mounted cell on the next frame. Browser find-in-page, screen readers
and DOM queries still see only the window; never assume every row has a DOM node.

**A row you add to the body is not part of the virtual size.** The draft row and
the empty state are rendered outside the windowed range and contribute height
that `totalSize` does not know about. Anything new in `<tbody>` follows the same
placement — outside the range — or the scrollbar lies.

**Display distinguishes NULL from empty string; the editor cannot.**
`formatCellValue` renders null and undefined as an italic `NULL` and an empty
string as an empty cell, and that contrast is the user's only signal — do not add
a placeholder for empty. On the way in, `valueToEditString` maps null and
undefined to the empty string, so the two collapse the moment an editor opens.
`normalizeValueForInsert` in
`packages/studio/src/features/database-studio/utils/studio-data.ts` is the single
place that decides what an emptied editor means: null for a nullable column,
otherwise `0`, `false` or the empty string by type. The consequence is real and
must not be papered over — a nullable column cannot be set to an empty string
through the cell editor, and a non-nullable one cannot be set to null. Never add
a second normalization between the editor and the mutation.

**"Default" in the grid is never the database's declared DEFAULT.** The grid has
no access to it. `getColumnDefault` infers one from column type and name — a
timestamp for date-ish and audit columns, null when nullable, the empty string
otherwise — and that inferred value is what Backspace writes into the focused
cell, skipping primary keys. Do not label it as the column default in UI copy,
and do not use it to decide whether a column was set.

**The draft row is a separate editor with its own rules.** It shows `auto` in
every primary-key cell and never edits one, uses `NULL` as the placeholder for a
nullable column, walks only non-key columns on Tab, and saves on Enter or on Tab
past the last column. It is not a row in `rows` and holds no index in
`selectedRows`.

**Staged edits live in the pending-edits store, never in the grid.** The grid
holds only the in-flight editor text and receives `pendingEdits` as a `Set` of
`pkValue:columnName` strings used for exactly one thing: painting the dirty cell.
The buffer is `PendingEditsProvider` in
`packages/studio/src/core/pending-edits/pending-edits-store.tsx`, a `Map` keyed by
`createEditKey(tableId, primaryKeyValue, columnName)`, in memory and never
persisted, and it is filled only while `isDryEditMode` is on. With dry mode off
there is no staging: `handleCellEdit` writes through immediately behind an
optimistic paint that reverts on error. Do not open a second staging area.

**Staged edits commit per edit and discard by refetch.**
`handleApplyPendingEdits` in
`packages/studio/src/features/database-studio/hooks/use-database-studio-edits.ts`
issues one update per edit through `Promise.allSettled`, drops only the edits
that landed so a retry does not re-issue accepted writes, reverts the failed
cells to `oldValue` on screen, and patches the cache rather than reloading.
`handleDiscardPendingEdits` clears the buffer and reloads, because what is on
screen is optimistic and nothing else can undo it. Undo removes the last buffered
edit and resolves its row by primary key, never by a stored index — after a sort,
filter or page change that index points somewhere else. `overlayPendingEditsOnRows`
in `packages/studio/src/core/pending-edits/overlay.ts` repaints the buffer over
freshly loaded rows for the same reason.

**A commit that changes nothing is not a commit.** `commitEdit` compares the
editor text against `originalEditValueRef` with `areValuesEqual` and returns
without calling `onCellEdit`. Any new commit path routes through `commitEdit`
rather than calling the callback directly.

**A blur is not proof the user left the cell.** `useCellEditing` keeps a 250ms
`justOpenedRef` window in which a blur is treated as a focus-steal and the editor
re-focuses itself, and a `skipNextBlurSaveRef` flag for the Tab-and-move commit.
A new teardown path sets those flags rather than tearing the editor down on the
first blur it sees.

**Bare printable keys are commands, not text.** With a cell focused, `e` and
`F2` and `Enter` open the editor, `d` deletes, `c` copies, `v` pastes, Space
toggles the row, Backspace clears to the inferred default, and the default branch
swallows every other lone printable key so it neither types nor escapes to a
document-level shortcut. Editing is only ever entered explicitly. Adding a new
bare-letter command means checking it against that list first.

**The grid is one tab stop with roving focus.** The `<table>` is the only
tabbable node; the row checkboxes and the FK icon carry `tabIndex={-1}`, and
`focusedCell` is the roving position. Any new interactive element inside a cell
is `tabIndex={-1}` or Tab stops walking cells.

**Privacy mode is a hard read-only, checked first.** `formatCellValue` returns
the fixed `MASK_TOKEN` before it looks at the value, so neither the value nor its
length leaks, and `useGridKeyboard` blocks edit, copy, paste and delete while
`masked` is set. A new cell renderer honours `masked` as its first branch; a new
command checks it before acting.

**A cell key is `row:col`, produced by `getCellKey`.** The same string is the
`data-cell-key` attribute, the member of the selection `Set`, and what
`useCellSelection` splits back into a row and column index. Build it with
`getCellKey` and rectangles with `getCellsInRectangle`.

**Selection and focus are optionally controlled — both halves or neither.**
`useCellSelection` uses `externalSelectedCells` when it is passed and its own
state otherwise; `useFocusedCell` mirrors `initialFocusedCell` into state and
reports through `onFocusedCellChange`. Passing the value without the callback
gives a grid that reverts on every interaction.

**Column widths are per mount.** `useColumnResize` holds them in component state
with `MIN_COLUMN_WIDTH` 100 and `DEFAULT_COLUMN_WIDTH` 150, and nothing persists
them. Double-click auto-fit measures the header text on a canvas, not the cell
contents, so it fits the label and never the data.

**A blob cell renders the backend's string.** The backend already turned the
bytes into either an inline `0x…` hex string or a `<type — size>` summary in
`apps/desktop/src-tauri/src/database/blob_display.rs`; `detectBlob` in
`packages/studio/src/features/database-studio/components/cells/blob-utils.ts`
re-detects those two forms and `BlobCell` draws them. The renderer never has and
never fetches the bytes.

## Common mistakes

- Importing the adapter, the bindings or a query hook into a grid file instead of
  adding a prop.
- Using a row index as the identity of a row in anything that outlives the paint
  — a mutation payload, a staged edit, an undo entry.
- Falling back to a rowid, a column named `id`, or the row index when a table has
  no declared primary key, instead of refusing the action.
- Assuming every row has a DOM node: calling `querySelector` or `scrollIntoView`
  for a row that the virtual window does not currently render.
- Adding a variable-height cell renderer without accounting for the fixed 34px
  estimate.
- Rendering a placeholder for an empty string, which erases the only difference
  between empty and NULL on screen.
- Normalizing an edited value in the grid, or a second time in the owner, instead
  of leaving it to `normalizeValueForInsert`.
- Presenting the value from `getColumnDefault` as the column's database DEFAULT.
- Staging an edit inside the grid, or keying a staged edit by anything other than
  `createEditKey`.
- Clearing the whole pending buffer after a partial apply, which re-issues writes
  the database already accepted on the next retry.
- Calling `onCellEdit` directly from a new editor path instead of `commitEdit`,
  which loses the no-op check and the blur guards.
- Tearing the editor down on the first blur, which kills it the instant a context
  menu closes.
- Adding a tabbable control inside a cell, which breaks the single-tab-stop grid.
- Reading a value before checking `masked` in a new cell renderer.
- Assuming type-to-edit works: `startTypeEdit` exists in `use-cell-editing.ts`
  but nothing passes it, and the keyboard handler deliberately swallows lone
  printable keys.

## Verification

From the repository root:

```bash
bun run --cwd packages/studio test
bun run --cwd packages/studio typecheck
bun run test:desktop
bun run lint
```

`test:desktop` is the CI gate and runs the same suite the studio `test` script
does. The tests that pin this contract are the ones for `parseClipboardGrid`,
`overlayPendingEditsOnRows`, `normalizeValueForInsert`, and the pending-edit
apply path — a change that breaks one of those is a behaviour change, not a test
to update.

## Definition of done

- No grid file gained an import of the adapter, the bindings or a query hook.
- Every new value the grid draws arrives as a prop; every new intent leaves as a
  callback declared in both `data-grid.tsx` and `grid-body.tsx`.
- Anything addressed outside the current paint uses the primary key, and refuses
  through `notifyMissingPrimaryKey` when there is none.
- Nothing new assumes a row index has a mounted DOM node, and no new body row is
  rendered inside the virtualized range.
- NULL still reads differently from an empty string on screen, and value
  normalization still happens in exactly one place.
- New staged state went into the pending-edits store under `createEditKey`, and
  a partial apply still drops only the edits that landed.
- New editor paths go through `commitEdit` and respect the blur guards.
- New in-cell controls are `tabIndex={-1}` and check `masked` first.
- All four commands above pass.

See `reference.md` for the prop contract, the keyboard map, the cell-renderer
dispatch order, and the edit-commit state machine.

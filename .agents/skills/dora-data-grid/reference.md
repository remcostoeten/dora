# Data grid reference

Detail behind `SKILL.md`. Rendering only.

## File map

| File under `packages/studio/src/features/database-studio/` | Owns |
| --- | --- |
| `components/data-grid.tsx` | Prop contract, the scroll container and `<table>`, the virtualization threshold, wiring every hook together |
| `components/data-grid/grid-header.tsx` | Header row, sort affordance, resize handle, truncation-only tooltip |
| `components/data-grid/grid-body.tsx` | `GridRow` (memoized), spacer rows, draft-row placement, empty state |
| `components/data-grid/cell-value.tsx` | `formatCellValue` and the inline `JsonCell` |
| `components/data-grid/draft-row.tsx` | The insert draft row and its own keyboard handling |
| `components/data-grid/use-cell-editing.ts` | Editor state, commit, cancel, blur guards, Tab-and-move |
| `components/data-grid/use-grid-keyboard.ts` | Dispatches a key event to the command table |
| `components/data-grid/grid-commands.ts` | `GRID_COMMANDS`, the keymap as data, plus `buildGridKeymap` and `resolveGridCommand` |
| `components/data-grid/grid-navigation.ts` | Pure target-cell functions for steps, edges, pages and Tab |
| `components/data-grid/grid-go-to.ts` | `parseGoToQuery`, `findColumnIndex`, `resolveGoToTarget` |
| `components/data-grid/go-to-cell-prompt.tsx` | The go-to-cell prompt |
| `components/data-grid/grid-clipboard.ts` | `parseClipboardGrid`, clipboard copy and paste |
| `components/data-grid/grid-events.ts` | `isDataGridEvent`, `isTextEntryEvent` |
| `components/data-grid/grid-edits.ts` | Pure planners for clear, set NULL, fill down, paste and fill selection |
| `components/data-grid/use-cell-selection.ts` | Cell selection set and its by-row index |
| `components/data-grid/use-row-selection.ts` | Click, shift-range and context-menu row selection |
| `components/data-grid/use-focused-cell.ts` | Roving focus position |
| `components/data-grid/use-column-resize.ts` | Widths, drag resize, canvas auto-fit |
| `components/data-grid/use-row-virtualizer.ts` | The virtualizer wrapper |
| `components/data-grid/use-right-drag-scroll.ts` | Right-button drag to scroll horizontally |
| `components/data-grid/use-context-menu-reporting.ts` | Reports menu open state and coordinates upward |
| `components/data-grid/selection.ts` | `getCellKey`, `parseCellKey`, `getCellsInRectangle`, `getSelectionSpan`, `getRowCells`, `getColumnCells`, `getRowToggle` |
| `components/data-grid/types.ts` | `EditingCell`, `CellPosition`, `ContextMenuState` |
| `components/cells/` | `BlobCell`, `DateCell`, `IpCell`, `TokenCell`, `blob-utils.ts` |
| `types.ts` | `ColumnDefinition`, `TableData`, `SortDescriptor`, `FilterDescriptor` |
| `utils/studio-data.ts` | `getColumnDefault`, `normalizeValueForInsert`, row helpers |

## Prop contract

`DataGrid` takes rows and columns and nothing else that reads from a database.
Groups:

- **Data** — `columns`, `rows`, `tableName`.
- **Row selection** — `selectedRows`, `onRowSelect`, `onRowsSelect`,
  `onSelectAll`.
- **Cell selection and focus** — `selectedCells`, `onCellSelectionChange`,
  `initialFocusedCell`, `onFocusedCellChange`. Each is a controlled pair.
- **Sort and filter** — `sort`, `onSortChange`, `onFilterAdd`. The grid computes
  the next sort state in `handleSort` (asc, then desc, then cleared) and reports
  it; it never sorts rows itself.
- **Mutation intent** — `onCellEdit`, `onCellsEdit`, `onBatchCellEdit`,
  `onDeleteSelectedRows`, `onRowAction`, `onInsertRow`, `onBlobAction`,
  `onFKNavigate`. Omitting one disables that affordance.
- **Notices** — `onNotify`, for outcomes the owner turns into a toast.
- **Draft row** — `draftRow`, `draftInsertIndex`, `onDraftChange`, `onDraftSave`,
  `onDraftCancel`. `draftInsertIndex` of null, undefined or `-1` puts the draft
  at the top; any other value puts it after that row index.
- **Presentation of staged state** — `pendingEdits`, a `Set` of
  `pkValue:columnName`.
- **Menus** — `onContextMenuChange`.
- **Paging** — `rowNumberOffset`, `totalRowCount`, `onRequestRow`,
  `onPageChange`. The grid only reports the intent; the owner holds
  `pagination` and fetches.

## Column definition

`ColumnDefinition` carries `name`, `type`, `nullable`, `primaryKey`, an optional
`foreignKey` and an optional `allowedValues`. `allowedValues` is a closed set the
database constrains the column to — a Postgres enum, a MySQL `ENUM`, or a
`CHECK (col IN (...))` list — and its presence is what switches the editor from a
text input to a `<select>`.

## Cell renderer dispatch order

`formatCellValue` returns on the first match, so order is the contract:

1. `masked` — the fixed `MASK_TOKEN` from
   `packages/studio/src/core/privacy/mask.ts`, before the value is read at all.
2. null or undefined — italic `NULL`.
3. `detectBlob` hit — `BlobCell`.
4. Column name containing `ip_address` or `ip_addr` — `IpCell`.
5. Column name containing `token`, `hash`, `key` or `signature`, with a string
   longer than 20 characters — `TokenCell`.
6. Column name ending `_at` or `_date`, or named `date` or `timestamp`, or a type
   containing `timestamp` or `date` — `DateCell`.
7. `boolean` — a check or cross glyph.
8. `number` — right-aligned monospace.
9. `object` — `JsonCell`, collapsed to a `{n keys}` or `[n items]` summary.
10. String in a column whose type contains `json` and which parses as an object
    or array — `JsonCell`.
11. Everything else — `String(value)`.

Steps 4 to 6 match on the column *name*, so a rename changes rendering. Anything
new that matches on name goes into the same chain rather than into a caller.

## Blob detection

`blob_display.rs` produces two forms: an inline uppercase `0x…` hex string for
blobs of 64 bytes or fewer, and a `<type — size>` summary otherwise. `detectBlob`
accepts the summary form on its own because no real text looks like it, but only
accepts the hex form when the column type looks binary (`blob`, `bytea`,
`binary`, `varbinary`), so hex-looking text in a normal column is left alone.
`bytesToHex` and `bytesToBase64` convert the byte array the owner fetches.

## Keyboard map

The keymap is data. `GRID_COMMANDS` in `grid-commands.ts` lists every command
by the name of its entry in the `data-grid` scope of `APP_SHORTCUTS`
(`packages/studio/src/core/shortcuts/shortcuts.ts`), so the defaults below are
the registry defaults, a user remap applies inside the grid, and the settings
shortcuts screen lists them. A combo matches on its exact modifiers. A new
command is a registry entry plus a `GRID_COMMANDS` entry, never a `switch` arm.

With a cell focused:

| Key | Effect |
| --- | --- |
| First arrow, Tab or Enter with no focus | Focus lands on the top-left cell |
| Arrows | Move one cell; with ctrl or cmd, jump to the edge |
| PageUp, PageDown | Move by the number of rows that fit in the viewport |
| Home, End | First and last column of the row; with ctrl or cmd, first and last cell |
| mod+g | Open the go-to-cell prompt |
| alt+PageUp, alt+PageDown | Previous and next page of results, through `onPageChange` |
| Shift plus arrows | Extend a rectangular cell selection from the anchor |
| Shift plus PageUp, PageDown, Home, End; mod+shift plus arrows, Home, End | Extend the selection by a page, to the row edge, or to the grid edge |
| shift+Space | Select every cell in the row, or in every row the selection spans |
| ctrl+Space | Select every cell in the column, or in every column the selection spans |
| Tab and shift+Tab | Move one cell, wrapping across rows; Tab escapes the grid at the last cell |
| Enter, F2, `e` | Open the editor on the focused cell |
| Delete, `d` | Delete the selected rows, falling back to the focused row |
| Backspace | Write `getColumnDefault` into every selected cell, falling back to the focused cell; primary keys are skipped |
| Escape | Progressive: collapse a multi-cell selection, then drop the row selection, then clear focus. mod+d no longer deselects |
| Space | Check or uncheck the focused row; with a selection that spans several rows, all of them |
| `s` | Cycle the focused column's sort state |
| Shift+F10 or Context Menu | Open the focused cell's action menu on its first item |
| alt+shift+F10 or shift+Context Menu | Open the focused row's action menu on its first item |
| alt+Enter, shift+Enter | Edit row in the row editor, view row details |
| mod+shift+d | Duplicate the row, or every checked row when the focused row is one of them |
| `o`, Insert, mod+shift+i; shift+`o`, shift+Insert | Open the draft row below or above the focused row |
| mod+Backspace | Set the selected cells to NULL; non-nullable columns and primary keys are refused with a notice |
| mod+d | Fill down: the top selected row into the cells below it, or the row above into a single row |
| mod+shift+Enter, while editing | Commit the editor value into every selected cell through `onBatchCellEdit` |
| mod+shift+e | Toggle dry run mode |
| mod+s | Apply the staged edits |
| mod+shift+Backspace | Discard the staged edits, behind a confirm dialog |
| alt+Backspace, alt+shift+Backspace | Revert the staged edit in the focused cell, or every staged edit in the focused row |
| mod+shift+p | Show the staged edits as SQL |
| mod+z; mod+shift+z, mod+y | Undo and redo |
| `c`, mod+c | Copy the selection, or the focused cell, as TSV |
| `v`, mod+v | Paste TSV from the focused cell, clipped to the existing row and column count; a clipped paste reports how much was dropped |
| mod+a | Toggle select all |
| Any other lone printable key | Swallowed |

The go-to-cell prompt (`go-to-cell-prompt.tsx`, logic in `grid-go-to.ts`) takes
a row (`120`), a column (`email`, fuzzy matched, or a 1-based position), or
both (`120:email`, `120,3`); a leading separator (`:2024`) forces a column
whose name is a number. Row numbers are 1-based and absolute across pages,
which is why the grid takes `rowNumberOffset` and `totalRowCount`. A row in the
loaded page is focused in place and reaches the DOM through the virtualizer's
`scrollToIndex`; a row on another page leaves as `onRequestRow`, and the owner
changes the page and focuses the cell once the rows arrive.

Space and shift+Space are two different selections. Space drives the row
checkboxes (`selectedRows`), which is what delete, duplicate and export act on.
shift+Space and ctrl+Space build a cell selection, which is what copy, clear
and fill act on. Checking a range of rows from the keyboard is shift+arrows
followed by Space. ctrl+Space is `ctrl` on every platform, because cmd+Space
belongs to macOS. Selecting a row or column leaves the anchor where it was, so
the next shift+arrow goes back to a rectangle from that anchor.

Edits that do not come from the cell editor (clear, set NULL, fill down,
paste) are planned by pure functions in `grid-edits.ts` and leave through
`onCellsEdit` as one batch, falling back to one `onCellEdit` per cell when the
owner passes none. The owner's `handleCellsEdit` resolves them to primary keys
with `resolveCellChanges`, stages them in dry mode and otherwise issues one
`updateCells` call with one undo entry. `handleBatchCellEdit` is the same path,
so a batch edit no longer bypasses dry mode. Anything the user has to be told
(a refused NULL, a clipped paste) leaves as `onNotify`; the grid shows no toast
of its own.

Dry run, apply, discard, preview, undo and redo leave the grid as
`onStagedAction`, and revert as `onRevertStaged`. The owner binds the same
registry entries at window level, skipping grid events, so they also work from
the toolbar. There is one undo dispatcher: `pickUndoTarget` in
`packages/studio/src/core/undo/use-undo.ts` sends undo and redo to the staged
steps while dry mode is on and to the committed mutations otherwise. Neither
`useUndo` nor the edits hook listens for keys of its own. Committed redo keeps
the 10 second window of undo, is cleared by any new mutation, and a redone row
delete targets the primary keys the rows were deleted with.

The SQL preview is built by `buildPendingEditsSql`
(`packages/studio/src/features/database-studio/utils/pending-edits-sql.ts`). It
is a rendering: staged edits are applied one bound-parameter update at a time,
so the dialog calls the statements equivalent, not literal.

The menus are opened from the keyboard by dispatching a `contextmenu` event on
the focused cell or on the row's checkbox cell, so the mouse and keyboard paths
share one arming mechanism. Items show their shortcut from the registry. On
close, focus goes back to the grid unless the action opened the cell editor.

Navigation is coalesced through a single `requestAnimationFrame`, cancelled on
Escape and on unmount, so a held arrow key does not queue a state write per
event.

Clipboard round-trip: copy joins cells with tabs and rows with newlines, writing
an empty string for null and undefined. `parseClipboardGrid` normalizes CRLF and
bare CR, drops one trailing newline so a copied block does not overwrite the row
below the paste target, and keeps interior blank lines positional.

The grid is the only handler for keys pressed inside it. The window-level
`selectAll`, `deselect` and `deleteRows` bindings in `data-grid.tsx` and
`database-studio.tsx` carry `.except(isDataGridEvent)`, because the shortcut
library does not look at `defaultPrevented` and would otherwise run the action a
second time. They still serve focus that sits elsewhere in the studio.

The key after a chord prefix such as `g` is never a grid command, so `g d`
goes to the dashboard without also deleting rows. Keys from the cell editor and
the draft row inputs are ignored through `isTextEntryEvent`.

## Edit commit state machine

`useCellEditing` holds `editingCell`, `editValue`, and three refs that make the
commit decidable synchronously: `editValueRef`, `originalEditValueRef` and
`editingCellRef`.

- **Open** — `handleCellDoubleClick` seeds the editor from the current value with
  select-all, records the original, and focuses in a `useLayoutEffect` so no
  keystroke is dropped. `startTypeEdit` is the seed-with-a-character variant and
  is currently unwired.
- **Commit** — `commitEdit({ clear, refocus })` compares against the original
  with `areValuesEqual` and calls `onCellEdit` only when they differ.
  `handleSaveEdit` is Enter and click-away; `handleSelectCommit` is the dropdown,
  which writes `editValueRef` synchronously first because state is async;
  `handleSaveEditAndMove` is Tab, which commits without clearing, sets
  `skipNextBlurSaveRef`, then opens the editor on the next or previous cell.
- **Blur** — `handleEditBlur` returns early when `skipNextBlurSaveRef` is set,
  re-focuses the input when `justOpenedRef` is still true (a 250ms window after
  mount, covering a Radix menu closing or a `JsonCell` button unmounting), and
  otherwise commits.
- **Cancel** — Escape clears without calling `onCellEdit`.
- **Refocus** — the grid `<table>` is refocused in a `requestAnimationFrame`
  after a clearing commit, so the keyboard map takes over again.

Editors carry `data-no-shortcuts='true'` so document-level shortcuts do not fire
while typing.

## Selection model

- Row selection is a `Set<number>` of indexes owned by the caller. Plain click
  only records the anchor in `lastClickedRowRef`; ctrl or cmd toggles; shift
  replaces the selection with the range from the anchor.
- Opening a context menu on an unselected row replaces the selection with that
  row (`ensureRowSelectionForContextMenu`), so a menu action never acts on
  something invisible.
- `GridRow` falls back to a one-row selection for its menus when nothing is
  selected but a cell in that row is focused. Batch actions require a size above
  one, so the fallback never leaks into a batch.
- Cell selection is a `Set` of `row:col` strings, re-indexed into
  `Map<number, Set<number>>` by `useCellSelection` so a row can test its own
  columns without scanning the whole set.
- `GridRow` is memoized on exactly the slices it needs — `isRowSelected`,
  `rowSelectedCols`, `focusedCol`, and an `editingColumnName` that is null unless
  the editor is in that row — so grid-level churn re-renders only the rows it
  touches. Passing a new object or closure per row per render defeats this.

## Virtualization

`useRowVirtualizer` wraps `@tanstack/react-virtual` with `ROW_HEIGHT` 34,
`OVERSCAN` 12, and an `enabled` flag; when disabled it returns null for both
`virtualRows` and `totalSize` and the body renders every row. `grid-body.tsx`
derives the top pad from the first virtual item's `start` and the bottom pad from
`totalSize` minus the last item's `start` plus `size`, and emits each as a single
spacer `<tr>` with one `colSpan` cell.

Each mounted virtual row passes its `<tr>` to `measureElement` and carries its
logical index in `data-index`, so expanded JSON and other variable-height
content update the virtualizer's measurements. The header is sticky via CSS
rather than virtualized, the checkbox column is sticky and needs an opaque
background token (translucent row tints let scrolled content bleed through),
and the inline draft row only appears when its anchor row index is inside the
window.

## Staged edits, end to end

1. `handleCellEdit` normalizes with `normalizeValueForInsert`, returns early when
   the value is unchanged, and refuses without a primary key.
2. Dry mode on: the edit goes into the store under
   `createEditKey(tableId, primaryKeyValue, columnName)` and the row is patched
   on screen. Re-editing back to the original `oldValue` removes the entry
   instead of storing a no-op.
3. Dry mode off: the row is patched optimistically, the update is issued, and on
   success the cached page is patched too — deliberately not reloaded, because a
   reload repaints the stale page first and reads as a flash back to the old
   value. On failure the cell reverts.
4. Apply: `Promise.allSettled` over the buffer; fulfilled edits are removed
   individually when any failed, or the whole table's buffer is cleared when none
   did; failed cells revert to `oldValue` and the toast names each failed row and
   column.
5. Discard: clear the buffer, then reload. From the keyboard it sits behind a
   confirm dialog whose default focus is "Keep editing".
6. Revert: `handleRevertStaged` removes the staged edit of one cell, or of
   every cell in a row, resolves the row by primary key and repaints `oldValue`.
7. Undo and redo: the buffer keeps an undo and a redo stack of staged steps
   (`packages/studio/src/core/pending-edits/staged-history.ts`). A step is one
   user action, so a multi-cell clear or paste is undone in one go, and a revert
   is itself undoable. `revertEdits` is the undoable removal; `removeEdit` and
   `clearEdits` are not, and drop the table's history, because an applied or
   discarded edit must never come back through undo.
8. Reload while edits are buffered: `overlayPendingEditsOnRows` repaints them by
   primary key, so buffered edits for rows that are not on the current page stay
   buffered and untouched.

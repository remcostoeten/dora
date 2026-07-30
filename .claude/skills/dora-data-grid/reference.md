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
| `components/data-grid/use-grid-keyboard.ts` | The whole keyboard map, clipboard copy and paste |
| `components/data-grid/use-cell-selection.ts` | Cell selection set and its by-row index |
| `components/data-grid/use-row-selection.ts` | Click, shift-range and context-menu row selection |
| `components/data-grid/use-focused-cell.ts` | Roving focus position |
| `components/data-grid/use-column-resize.ts` | Widths, drag resize, canvas auto-fit |
| `components/data-grid/use-row-virtualizer.ts` | The virtualizer wrapper |
| `components/data-grid/use-right-drag-scroll.ts` | Right-button drag to scroll horizontally |
| `components/data-grid/use-context-menu-reporting.ts` | Reports menu open state and coordinates upward |
| `components/data-grid/selection.ts` | `getCellKey`, `getCellsInRectangle` |
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
- **Mutation intent** — `onCellEdit`, `onBatchCellEdit`, `onDeleteSelectedRows`,
  `onRowAction`, `onBlobAction`, `onFKNavigate`. Omitting one disables that
  affordance.
- **Draft row** — `draftRow`, `draftInsertIndex`, `onDraftChange`, `onDraftSave`,
  `onDraftCancel`. `draftInsertIndex` of null, undefined or `-1` puts the draft
  at the top; any other value puts it after that row index.
- **Presentation of staged state** — `pendingEdits`, a `Set` of
  `pkValue:columnName`.
- **Menus** — `onContextMenuChange`.

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

With a cell focused, from `use-grid-keyboard.ts`:

| Key | Effect |
| --- | --- |
| First arrow, Tab or Enter with no focus | Focus lands on the top-left cell |
| Arrows | Move one cell; with ctrl or cmd, jump to the edge |
| Shift plus arrows | Left and right extend the cell rectangle from the anchor; up and down extend the *row* selection instead and clear the cell selection |
| Tab and shift+Tab | Move one cell, wrapping across rows; Tab escapes the grid at the last cell |
| Enter, F2, `e` | Open the editor on the focused cell |
| Delete, `d` | Delete the selected rows, falling back to the focused row |
| Backspace | Write `getColumnDefault` into the focused cell; skipped on a primary key |
| Escape | Progressive: collapse a multi-cell selection, then drop the row selection, then clear focus |
| Space | Toggle the focused row; with shift, select the range from the last clicked row |
| `c`, mod+c | Copy the selection, or the focused cell, as TSV |
| `v`, mod+v | Paste TSV from the focused cell, clipped to the existing row and column count |
| mod+a | Toggle select all |
| Any other lone printable key | Swallowed |

Navigation is coalesced through a single `requestAnimationFrame`, cancelled on
Escape and on unmount, so a held arrow key does not queue a state write per
event.

Clipboard round-trip: copy joins cells with tabs and rows with newlines, writing
an empty string for null and undefined. `parseClipboardGrid` normalizes CRLF and
bare CR, drops one trailing newline so a copied block does not overwrite the row
below the paste target, and keeps interior blank lines positional.

Outside the grid element, the `selectAll` and `deselect` shortcuts are bound
through `useShortcut` under the `data-grid` scope, both `.except('typing')`.

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

Consequences worth restating: there is no `measureElement`, the header is sticky
via CSS rather than virtualized, the checkbox column is sticky and needs an
opaque background token (translucent row tints let scrolled content bleed
through), and the inline draft row only appears when its anchor row index is
inside the window.

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
5. Discard: clear the buffer, then reload.
6. Reload while edits are buffered: `overlayPendingEditsOnRows` repaints them by
   primary key, so buffered edits for rows that are not on the current page stay
   buffered and untouched.

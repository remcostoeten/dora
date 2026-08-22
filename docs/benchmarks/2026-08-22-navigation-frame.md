# Benchmark — 2026-08-22, after the navigation-frame fix

Fourth run of the harness. Track 3 left the four navigation timings flat at
350–480 ms P95 and pointed at one long synchronous frame on the Data Viewer
path that had not been profiled. This run profiled it, fixed what the profile
showed, and re-recorded. Compare against `2026-08-22-track-3.md` (same machine,
same fixtures, dev build of Studio under Vite as before).

All four navigation timings dropped 6–7× and every render invariant stays
green. The budgets are still not met; see "Reading these numbers" for what the
rest of the frame is.

## Environment

| | |
| --- | --- |
| Commit | branch `perf/track-2-workspace-store`, navigation-frame follow-up |
| Host | Linux 7.1.2-arch, 16 cores |
| Browser | Headless Chromium via Playwright 1.59, 1600×900 |
| Target | Browser-mode Studio, `localhost:1420`, mock adapter, Vite dev build |
| Fixtures | 200 tables / 2,000 columns, 100k-row table, 10 connections, 50 saved queries |
| Samples | 21 iterations per scenario, first dropped as warm-up |
| Raw data | `packages/studio/perf-artifacts/2026-08-22T17-25-19-317Z.json` |
| Profiles | `packages/studio/perf-artifacts/profile-cached-table-switch-*.cpuprofile` |

## Timings

| Scenario | After Track 3 P95 | Now P95 | Now P50 | Budget |
| --- | --- | --- | --- | --- |
| View switch → SQL Console | 350.3 ms | 53.4 ms | 43.7 ms | P95 < 16 ms |
| View switch → Data Viewer | 365.7 ms | 61.1 ms | 51.5 ms | P95 < 16 ms |
| Cached table switch | 433.0 ms | 66.8 ms | 66.5 ms | P95 < 8 ms |
| Connection switch (cached schema) | 481.1 ms | 148.4 ms | 130.6 ms | P95 < 16 ms |
| 100k-row first paint | 87.6 ms | 75.7 ms | 56.5 ms | < 100 ms — pass |

Long animation frames across the run: 55, worst 216.8 ms (previous: 268, worst
311.1 ms).

## Render invariants

| Invariant | After Track 3 | Now |
| --- | --- | --- |
| Zero remounts, Data Viewer | pass | pass |
| Zero remounts, SQL Console | pass | pass |
| One Monaco per session | pass | pass |
| Zero shell commits on keystroke | pass (0 / 58) | pass (0 / 58, invariant spec) |
| Zero IPC on a cached table switch | pass | pass |

The timing spec's own keystroke counter read 4 in this run and 0 or 10 in the
runs around it; the dedicated invariant spec read 0 every time. It is the
trailing-work leak the Track 3 note describes (the timing spec types right
after twenty 100k-row queries), not a product regression, and the invariant
spec is the one CI asserts.

## How the frame was found

A new opt-in spec, `PERF_PROFILE=1 bun perf -- --grep @profile`, wraps six
cached table switches in a CDP CPU profile (100 µs sampling) plus a Chrome
trace and prints self/total time by function and trace time by event. Two
findings drove the fix:

1. **The grid and the sidebar each mounted a Radix menu per item.** Every data
   cell was wrapped in its own `ContextMenu` (root, popper and menu providers,
   portal, presence — roughly a dozen fibers) and every row in another; every
   one of the 200 sidebar rows carried a `ContextMenu` and a `DropdownMenu`.
   A 50×5 page was ~300 closed menus, the sidebar ~400, all re-rendered on
   each switch. `useComposedScopes`, `Provider`, `useScope`, `Presence` and
   `Portal` were the top self-time entries, ahead of anything in `src/`.
2. **One switch caused four full-tree React renders.** Attributing each commit
   to its render roots (fibers with `PerformedWork`) showed: the click's own
   render rooted at `WorkspaceShell`, because the shell's startup hook
   subscribed to the active tab for URL sync; a second render rooted at
   `DatabaseStudio`, from the table-change effect resetting
   pagination/sort/filters/visible columns/table data to new-but-equal values;
   a third rooted at `BrowserRouter`, because the URL write re-rendered the
   shell as a `useSearchParams` consumer; and every one of them re-rendered all
   50 `GridRow`s because the studio hands the grid new handler identities on
   each render, and `getConnectionEditState` returned a fresh `Map` for a
   connection with no pending edits, so `pendingEdits` never compared equal.

## What changed in the product

- `data-grid/grid-context-menu.tsx`: one `ContextMenu` for the whole grid.
  Cells and the checkbox cell only arm a target from `onContextMenu`; the
  shared trigger promotes it to state (or suppresses the menu when nothing
  armed it). `CellContextMenuItems` / `RowContextMenuItems` render the items
  for the target. Behaviour is unchanged: a data cell opens the cell menu, the
  checkbox cell opens the row menu, privacy mode opens nothing, "Edit cell"
  still keeps focus in the inline input.
- `sidebar/components/table-list.tsx`: one `ContextMenu` for the list, rows
  memoized with stable per-id callbacks (`useStableCallback`), and the "…"
  `DropdownMenu` mounted only while it is open or closing.
- `pages/workspace/workspace-url-sync.tsx`: URL sync, last-table persistence
  and the capture-ready marker moved out of `useWorkspaceStartup` into a
  null-rendering leaf, so neither a table switch nor a router location change
  re-renders the shell.
- `use-database-studio-sync.ts`: the table-change effect and the cached paint
  in `loadTableData` skip no-op resets (`isSameTableData`, `isSameStringSet`
  and value guards), so a cached switch is one commit.
- `DataGrid` pins the studio's row/selection/FK/edit handlers with
  `useStableCallback`; `pending-edits-store` returns one shared empty state;
  `LiveMonitorProvider` no longer puts `activeTable` in its context value
  (nothing read it).

## Reading these numbers

**One switch is now one render.** Per-commit attribution after the fix: the
click's render (~23 ms in the dev build, rooted at `WorkspaceViewsHost`), one
~8 ms router/URL follow-up, and the background refresh ~200 ms later. Painted
in 37 ms inside the page versus 50–100 ms as the harness reports it — the
harness waits two animation frames after the paint, which is 16–33 ms of the
number.

**What is left is the render itself, in a development build.** The CPU profile
after the fix is ~75% `FunctionCall` (React), 18 ms layout and 48 ms paint over
six switches. `GridRow×50` with their Radix checkboxes, the studio toolbar's 28
tooltips and the nine closed dialogs that receive `selectedTableId` are the
largest remaining groups. `jsxDEV`, `validateProperty` and
`warnUnknownProperties` — development-only work — are still three of the top
ten self-time entries, so the production build will land lower than these
figures, and the budgets should be judged against a production-mode run before
any further structural work.

**Connection switch is the outlier** at 148 ms: it still pays the sidebar's
200-row list for the new connection plus the studio, and it is not yet
attributed.

## Next

- Record the same scenarios against a production build (`vite preview` or the
  packaged app in browser mode) to separate dev-build overhead from real cost
  before deciding whether more navigation work is warranted.
- If it is: memoize the studio toolbar and dialogs against `selectedTableId`,
  replace the per-row Radix checkbox with a lighter control, and attribute the
  connection switch the same way.
- Then Track 4.

Re-record with `bun perf` and add a dated file next to this one; do not edit
this one.

# Dora performance contract

The budgets every interaction in Studio is held to, how each one is measured,
and what counts as a violation. Track 0 of `docs/architecture-roadmap.md` exists
to make this file enforceable; every later track is proved against it.

A budget here is a *contract*, not an aspiration. A change that breaks one is a
regression even when nothing looks wrong on screen.

## Scope

These budgets describe the renderer: React, the grid, the editor host and the
data provider between them. They are measured against browser-mode Studio
(`localhost:1420`, mock adapter), where IPC is a function call rather than a
Tauri bridge. That deliberately removes backend variance — the numbers describe
frontend work, and a frontend regression cannot hide behind a slow query.

Backend latency has its own budgets and is not covered here.

## Budgets

| # | Interaction | Timing budget | Invariant |
| --- | --- | --- | --- |
| 1 | View switch, Data Viewer ↔ SQL Console | P95 < 16 ms | Zero remounts of either view |
| 2 | Table switch, schema and rows already cached | P95 < 8 ms | Zero IPC calls |
| 3 | Connection switch, schema already cached | P95 < 16 ms | Zero remounts of the shell |
| 4 | Keystroke in the SQL editor | — | Zero React commits in the shell |
| 5 | 100k-row result | First rows painted < 100 ms | Scroll holds 60 fps |
| 6 | Cold start to interactive, 200-table schema | Set from the first baseline | — |

Every timing budget is a **P95 over at least 20 samples** on a warm app. P50 is
recorded but is not the gate: the gate is the frame a user actually waits on.
`max` is recorded to catch bimodal behaviour that a P95 hides.

### 1. View switch — P95 < 16 ms, zero remounts

One frame at 60 fps. Switching between the Data Viewer and the SQL Console is a
visibility change, not a teardown: both views keep their DOM, their scroll
offsets and their editor instances.

Measured from the click on the nav item to the first animation frame after the
target view is on screen.

The invariant is the stricter half. A remount is defined as: the DOM node that
hosted the view before the switch is no longer `isConnected` after switching
away and back. Today both views are branches of a ternary in `pages/Index.tsx`,
so both remount, and the invariant test is red by construction. Track 1 turns it
green.

### 2. Cached table switch — P95 < 8 ms, zero IPC

Half a frame. Selecting a table whose rows and columns are already in the
snapshot store must paint synchronously from that snapshot. A background
refresh may follow and reconcile; it must not gate the paint.

Zero IPC means zero adapter round-trips on the path to first paint. In browser
mode the mock adapter is instrumented by call count, so "zero IPC" is literal:
`fetchTableData` is not called before the paint. A cache miss is not a
violation of this budget — it is simply not this scenario.

### 3. Connection switch with cached schema — P95 < 16 ms, zero remounts

Switching to a connection whose schema is already cached repoints selectors; it
does not rebuild the shell. The nav sidebar, the editor host and the panel
layout keep their DOM nodes.

Connecting for the first time, or to a connection with no cached schema, is a
network operation and out of scope.

### 4. SQL editor keystroke — zero shell React commits

Monaco owns its own text. A keystroke inside it must not commit React in the
shell — not for a character counter, not for a dirty flag, not for autosave.

Measured by counting `onCommitFiberRoot` calls on the app root across a burst of
typed characters. The budget is exactly zero, not "few": one commit per
keystroke is the difference between an editor that feels native and one that
stutters at 120 wpm. Debounced work triggered by typing (autosave, validation)
must commit outside the burst, and the measurement window is the burst itself.

### 5. 100k-row result — first rows < 100 ms, 60 fps scroll

Painting the first screenful of a large result must not wait for the whole
result. Measured from the moment rows are available to the first frame with a
rendered cell, over a 100k-row fixture table.

Scroll is measured with long-animation-frame entries during a sustained scroll:
no frame over 16.7 ms, and no LoAF entry attributed to the grid over 50 ms.

### 6. Cold start with a 200-table schema — baseline first

Boot to interactive against a 200-table, 2,000-column schema. The roadmap sets
this budget *after* a baseline run rather than guessing it, because cold start
is dominated by bundle evaluation and fixture seeding rather than by the
interaction work the other budgets describe.

The first baseline is in `docs/benchmarks/`. The number recorded there is not
yet a gate.

## Render invariants

Timings drift with hardware. Invariants do not, which makes them the part of
this contract CI can enforce on a shared runner.

| Invariant | Holds when |
| --- | --- |
| Zero view remounts | Switching away and back leaves the previous view's DOM node connected |
| Zero shell commits on keystroke | Typing in Monaco produces no `onCommitFiberRoot` on the app root |
| Zero IPC on cached table switch | No adapter call precedes first paint |
| One Monaco instance per language family | The editor is created once per session, not once per view entry |

CI runs the invariants. It does not run timing assertions: a shared GitHub
runner is too noisy for a 16 ms P95, and a flaky perf gate gets disabled within
a week. Timings are collected locally with `bun perf` and committed as
baselines under `docs/benchmarks/`.

## Measurement rules

Rules that keep numbers comparable across runs:

- **In-page timing only.** Marks are taken inside the page around the click and
  the settled frame. A Playwright round-trip is ~1 ms of noise, which is 6% of a
  16 ms budget.
- **Settled means painted.** A scenario ends after two `requestAnimationFrame`
  callbacks following the DOM condition, so the measurement includes layout and
  paint rather than ending at a React commit.
- **Warm samples only.** The first iteration of each scenario is discarded; it
  measures lazy chunk loading, not the interaction.
- **Fixed viewport, headless Chromium.** 1600×900, one browser per run.
- **Raw samples are kept.** Every sample lands in the JSON output next to the
  percentiles, so a suspicious P95 can be traced to a run rather than re-argued.

## Running it

```
bun perf                      # full run: timings + invariants, writes JSON
bun perf --invariants         # what CI runs: invariants only
bun perf --iterations 40      # more samples for a baseline
```

Output goes to `packages/studio/perf-artifacts/<timestamp>.json`, with raw
samples plus P50/P95/max per scenario. Baselines worth keeping get summarized
into `docs/benchmarks/`.

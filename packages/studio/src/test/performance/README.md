# Performance harness

Measures Studio against `docs/performance-contract.md`. Playwright drives
browser-mode Studio (`localhost:1420`, mock adapter) — the same target as the
boot smoke, for the same reason: no Tauri backend means no backend variance, so
a frontend regression cannot hide behind a slow query.

## Running

```
bun perf                    # everything: invariants + the timing baseline
bun perf:invariants         # what CI runs — structure only, no timings
bun perf -- --grep @timing  # just the baseline run
```

`PERF_PROFILE=1 bun perf -- --grep @profile` CPU-profiles a cached table switch
(CDP sampling profiler plus a Chrome trace) and prints self/total time by
function and trace time by event; the `.cpuprofile` lands in `perf-artifacts/`
and opens in DevTools → Performance. Opt-in because the profiler distorts
timings. `PERF_ITERATIONS=40 bun perf` takes more samples. `PERF_BASE_URL` points the run
at an already-running dev server; otherwise Playwright starts one and reuses an
existing one if the port is taken.

Timing output lands in `packages/studio/perf-artifacts/<timestamp>.json` (raw
samples plus P50/P95/max, gitignored). Baselines worth keeping are summarized
into `docs/benchmarks/`.

## Layout

| File | Role |
| --- | --- |
| `invariants.spec.ts` | Render invariants — the CI half. Several are red by design |
| `timings.spec.ts` | Records the baseline. Asserts nothing about durations |
| `profile.spec.ts` | Opt-in CPU profile + trace of one scenario, for attributing a long frame |
| `lib/instrument.ts` | Browser-side probes, injected before app code |
| `lib/app.ts` | Boot, selectors, and the small state readers |
| `lib/measure.ts` | Scenario runners returning raw samples |
| `lib/stats.ts` | Percentiles |

## How it measures without touching product code

Three probes are installed by `page.addInitScript`, before any application
script runs:

- **React commits.** A `__REACT_DEVTOOLS_GLOBAL_HOOK__` shim. React reports
  every commit to that hook when it exists at module init, so commits can be
  counted per interaction without a `<Profiler>` in the tree.
- **Long frames.** A `PerformanceObserver` on `long-animation-frame`, falling
  back to `longtask` where LoAF is unavailable.
- **Monaco instances.** A `MutationObserver` that counts *distinct* editor root
  elements. It compares element identity rather than watching `addedNodes` for
  the class, because Monaco inserts a bare div and adds `.monaco-editor`
  afterwards — watching insertions reports a reassuring `1` forever.

Everything the harness clicks is markup the product already ships: accessible
names on the nav and table items, and `data-connection-id` on connection rows.

Two details that cost real debugging time, kept here so they are not
rediscovered:

- An init script runs *before the document is parsed*, so
  `document.documentElement` is null and `MutationObserver.observe` on it
  throws — silently taking the rest of the init function with it. Observe
  `document`.
- Scenario timing happens inside a single `page.evaluate`. A Playwright
  round-trip is roughly 1 ms, which is 6% of a 16 ms budget.

## Remounts

A remount is detected by parking a DOM node on `window` before a view switch and
asking whether it is still `isConnected` after switching away and back. It needs
no product hooks and it fails for exactly the reason the contract cares about.

## Fixtures

`core/data-provider/mock-data/perf-fixtures.ts` generates 200 tables / 2,000
columns, a 100k-row table, 10 connections and 50 saved queries from a seeded
PRNG — deterministic across machines, never committed as data.

They are opt-in: nothing loads unless `dora_perf_fixtures` is `"1"` in
localStorage (the harness sets it) or `?perf=1` is in the URL (for looking at
them by hand). The shipped demo dataset is unaffected.

## Known limits of these numbers

- **The mock adapter delays 50–150 ms on purpose** (`randomDelay`). Any scenario
  that reaches the adapter inherits that floor, so table-, connection-switch and
  first-paint numbers are *upper* bounds on renderer work, not pure renderer
  cost. Once a switch is served from a snapshot store it drops below that floor,
  which is what makes the sub-8 ms budget meaningful.
- **"Zero IPC" is inferred, not counted.** The adapter is a module-level object
  the harness cannot reach from the page, so there is no call counter yet. The
  50 ms delay floor stands in for one: a paint under 8 ms provably did not await
  the adapter. A real counter belongs with the Track 2 store seam.
- **Cold start is not measured yet.** With the perf fixtures the mock store
  seeds 100k rows on every load (~120 ms) and its `localStorage` write exceeds
  quota and silently fails, so a cold-start number here would describe fixture
  seeding more than app boot. Budget 6 stays open until it can be measured
  against a realistic seeding path.

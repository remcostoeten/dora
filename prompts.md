# Improvement prompts

Derived from the bundling/architecture audit (2026-08-01), verified against this repo.
Each prompt is self-contained — run them one at a time, in order. Each one ends with
acceptance criteria so the result is measurable, not vibes.

---

## Prompt 1 — Fix the broken `manualChunks` matching (P0, trivial)

> In `apps/desktop/vite.config.ts`, the `manualChunks` function matches vendor
> packages by substring. The first check `id.includes("react")` runs before the
> checks for `@xyflow/react`, `@radix-ui/*`, and `@tanstack/react-query`, so all
> of those get swallowed into the eager `vendor-react` chunk and the
> `vendor-flow` / `vendor-radix` branches are dead code. The concrete harm:
> XYFlow is only used by the lazy-loaded schema visualizer but currently loads
> at startup.
>
> Fix it:
> 1. Run `bun run build` in `apps/desktop` first and save the generated
>    `stats.html` (rollup-plugin-visualizer is already wired up) as the
>    **before** baseline. Note the size and contents of `vendor-react`.
> 2. Replace substring matching with package-boundary matching, e.g.
>    `id.includes("node_modules/react/")`, `id.includes("node_modules/react-dom/")`,
>    `id.includes("node_modules/react-router-dom/")` — or reorder so the most
>    specific packages match first. Prefer deleting vendor branches that no
>    longer earn their keep: the lazy `import()` boundaries already in the app
>    (DatabaseStudio, SqlConsole, schema visualizer, data seeder, connection
>    dialog, command palette) do the valuable splitting. Keep explicit handling
>    for Monaco and monaco-workers.
> 3. Build again, compare `stats.html` **after** vs before. Verify:
>    - `@xyflow/react` is no longer in the eager `vendor-react` chunk — it
>      should land in the lazy schema-visualizer chunk graph.
>    - No lazy feature chunk got accidentally promoted to eager.
> 4. Smoke-test: `bun run tauri dev`, open the app, open the schema visualizer
>    and the SQL console, confirm both still load.
>
> Acceptance: before/after chunk listing in the final report, xyflow out of the
> eager path, app boots and features work.

---

## Prompt 2 — Instrument startup and get `credential_storage::warm_up()` off the critical path (P1, biggest perceived win)

> In `apps/desktop/src-tauri/src/lib.rs`, startup runs synchronous work before
> the window is created, including `credential_storage::warm_up()`, which calls
> the keyring (`Entry::new(...).get_password()`). On Linux that can block on
> Secret Service over D-Bus — potentially hundreds of ms before the window
> even exists.
>
> Do this in two steps:
> 1. **Measure first.** Add `tracing` spans (tracing is already initialized)
>    around each startup stage: process start → runtime init → AppState/storage
>    → warm_up → Tauri builder → window created → frontend loaded. Log elapsed
>    ms per stage. Run 3 cold starts and 3 warm starts, record the numbers.
> 2. **If warm_up is measurably slow** (>50ms), move it off the critical path:
>    spawn it on the async runtime (`tauri::async_runtime::spawn`) after window
>    creation instead of blocking before it. Audit callers of the credential
>    backend to confirm nothing needs the warmed backend synchronously at boot —
>    if something does, make it await the warm-up handle rather than re-warming.
> 3. Re-measure and report before/after cold-start numbers.
>
> Acceptance: a table of per-stage startup timings before and after, warm_up
> no longer blocking window creation, no regression in credential reads
> (test: open the app, connect to a saved connection that has a stored
> password).

---

## Prompt 3 — Benchmark query IPC/serialization for large result sets (P1, measure before optimizing)

> For a database client, JSON-serializing large result sets across the Tauri
> IPC bridge (Rust serialize → IPC → JS parse → state update → grid render) is
> likely the real runtime ceiling — bigger than any JS bundle concern.
>
> 1. Create a benchmark scenario: a local Postgres (docker-compose.databases.yml
>    exists) with a table of 100k and 1M rows of mixed types.
> 2. Instrument the pipeline: time (a) Rust-side query execution, (b) Rust
>    serialization, (c) IPC transfer + JS deserialization, (d) state update to
>    first grid paint. Use tracing on the Rust side and performance.mark on the
>    JS side.
> 3. Report where the time actually goes at 10k / 100k / 1M rows.
> 4. Do NOT rewrite anything yet. Conclude with a recommendation: stay on JSON,
>    move to paged fetches, or invest in a binary/Arrow-style columnar payload —
>    justified by the measurements. Note that dora already has paging in the
>    query pipeline; measure what the grid actually requests.
>
> Acceptance: a timing breakdown table per stage per row count, and a one-
> paragraph recommendation grounded in those numbers.

---

## Prompt 4 — Consolidate frontend dependency ownership into `packages/studio` (P1, hygiene)

> `apps/desktop/package.json` and `packages/studio/package.json` currently
> duplicate 42 dependencies (all Radix packages, XYFlow, faker, framer-motion,
> React Query, zod, zustand, lucide, date-fns, drizzle-orm, monaco, ...).
> Studio already declares react/react-dom as peer deps, which is correct.
>
> 1. For each duplicated dep, determine the real owner: if it's only imported
>    under `packages/studio/src`, it belongs to studio; if only under
>    `apps/desktop/src`, to desktop; if both, studio owns it and desktop
>    consumes it transitively. Use grep on import statements — don't guess.
> 2. Remove each dep from the package.json that doesn't own it. Desktop should
>    end up with roughly: React runtime, Tauri JS APIs, router, bootstrap-level
>    deps, Vite/build tooling. Studio owns the UI graph.
> 3. `bun install`, then verify: `bun run build` in apps/desktop succeeds,
>    typecheck passes, `bun run tauri dev` boots and the studio renders.
> 4. Confirm versions didn't diverge in the process (single version per package
>    across the workspace).
>
> Acceptance: no dep listed in both manifests unless genuinely imported by
> both, build + typecheck green, app boots.

---

## Prompt 5 — Audit Tauri plugins and capability surface (P2)

> `src-tauri` initializes six plugins: opener, shell, updater, process, dialog,
> fs. `removeUnusedCommands: true` is already set. For each plugin:
> 1. Grep the frontend and Rust code for actual usage of the plugin's APIs.
> 2. If unused, remove the plugin registration, its Cargo dependency, and its
>    capability/permission entries.
> 3. For the ones that stay — especially shell, process, fs, opener — tighten
>    their capability scopes in the capabilities JSON to the narrowest set of
>    commands/paths actually used.
> 4. Build and smoke-test the features that use each remaining plugin
>    (updater check, open-in-browser, file dialogs, etc.).
>
> Acceptance: a table of plugin → used-by → kept/removed/scoped, green build,
> smoke tests pass.

---

## Prompt 6 — Root Cargo workspace + provider crate split (P2, do only after 1–5)

> Create a root `Cargo.toml` workspace and extract the backend from the single
> `apps/desktop/src-tauri` crate into focused crates. Do this for compile
> isolation and boundaries — it will NOT shrink the binary; don't sell it as a
> size win.
>
> 1. Start minimal: root workspace + extract `dora-core` (shared types/errors)
>    and one provider crate (e.g. `dora-postgres`) as a proof of shape under
>    `crates/`. Shared IPC types go to `dora-protocol` if circularity forces it.
> 2. `src-tauri` keeps only: Tauri init, command wrappers, window management,
>    plugin setup, AppState composition. Domain logic (drivers, query engine,
>    storage, SSH, cloud providers, AI) migrates out incrementally — one crate
>    per PR-sized step, workspace compiling green at every step.
> 3. Once ≥2 provider crates exist, add Cargo features on the desktop crate
>    (`postgres`, `mysql`, `sqlite`, `libsql`, `ssh`, `ai`) with the current
>    set as default, so dev/CI builds can compile a narrow feature set.
> 4. Measure and report: clean build time and incremental rebuild time (touch
>    one provider file) before vs after.
>
> Acceptance: workspace builds, tests pass (`cargo test` per the dora-testing
> skill), incremental rebuild measurably faster, src-tauri contains no
> database/domain logic for the migrated slices.

---

## Prompt 7 — Move fake-data generation to Rust (P3, only when seeding perf matters)

> Frontend seeding currently uses `@faker-js/faker` (already lazy-loaded, so
> zero startup cost — this is a runtime/perf change, not a bundle change).
> Rust already depends on `fake` + `rand`.
>
> 1. Extend the seeding Tauri command surface: frontend sends a `SeedConfig`
>    (table, row count, per-column generator kind + options), Rust generates
>    with `fake`/`rand` and batch-inserts, streaming progress events back.
> 2. Map the generator kinds the seeder UI currently offers to `fake`
>    equivalents; keep the UI as pure configuration.
> 3. Once parity is confirmed for every generator the UI exposes, remove
>    `@faker-js/faker` from the frontend and the `vendor-faker` chunk handling.
> 4. Benchmark: seed 50k rows before (JS faker → IPC) vs after (Rust). Follow
>    dora-database-parity — verify seeding against every engine that supports
>    it, not just Postgres.
>
> Acceptance: all seeder UI generator types work via Rust, faker gone from
> package.json, before/after seeding benchmark, parity check done.

---

## Prompt 8 — Benchmark mimalloc vs system allocator (P3, curiosity-driven)

> `src-tauri` sets mimalloc as the global allocator. Justify or remove it with
> data: build two release binaries (mimalloc vs system allocator) and compare
> startup RSS, memory after a 100k-row query, memory after closing results,
> and query latency. Keep whichever wins; document the numbers in the commit
> message either way.

---

## Ground rules for every prompt

- Baseline before, measure after. No change ships without its number.
- One prompt = one branch/commit scope. Don't chain them in a single session.
- `bun run build`, typecheck, and the relevant smoke test are the minimum bar.
- Follow the repo's `.claude/skills` (dora-testing, dora-tauri-boundary,
  dora-database-parity) where they apply.

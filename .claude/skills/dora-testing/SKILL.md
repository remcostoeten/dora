---
name: dora-testing
description: Dora's test architecture and CI verification gates. Use whenever adding or changing TypeScript/Vitest tests, Rust unit or integration tests, mocks and shared test setup, coverage configuration, the Playwright boot smoke, live database fixtures, test scripts, Cargo test features, or pull-request CI jobs and dependencies. Also use when deciding which commands prove a Dora change is verified. Pair with the domain skill for the behavior under test; this skill owns the harness and evidence, not the product contract.
---

# Testing

## Scope

This skill owns how Dora proves behavior:

- the shared Vitest configuration, setup and React dependency deduplication;
- TypeScript unit, component, hook, store and acceptance tests;
- Rust module tests and integration-test crates;
- opt-in real-database adapter tests;
- the browser boot smoke;
- coverage output, test scripts and pull-request CI gates.

It does not define what a feature should do. Load the relevant domain skill
alongside this one, and translate that domain's invariant into a regression
test. Release-channel workflows belong to `dora-release-cut`; performance
measurements are not a substitute for functional regression tests.

Read `reference.md` before changing a test command, configuration or CI job. It
records which entry points are live, which are dead, what PR CI actually runs,
and which engines or features are outside that run.

## Unencodable

Source has two or more answers. Ask before deciding.

- Where a new TypeScript test belongs. Root Vitest discovers both centralized
  `__tests__` files and colocated `*.test.*` files, while
  `__tests__/README.md` claims centralized tests are the only convention
  (FINDINGS 4.15).
- Whether to delete, revive or ignore `apps/desktop/vitest.config.ts`,
  `__tests__/setup/vitest.setup.ts` and `packages/studio/src/test/setup.ts`.
  None is used by the live test command.
- Whether `bun run test` should continue running the same shared Vitest suite
  through multiple workspace packages. Turbo invokes package scripts, and both
  desktop and studio point at the root config.
- What coverage percentage is required. Coverage reporters exist, but there is
  no threshold and CI does not run coverage.
- Whether a skipped live-database test should fail. Without
  `DORA_LIVE_DB_TESTS=1`, the live test functions return successfully instead of
  being marked ignored.

## Workflow

1. Name the invariant or failure mode before writing the test. A test that only
   mirrors implementation structure is not regression evidence.
2. Choose the lowest honest layer: a pure function test first, then a hook or
   component test, then a Rust adapter/service test, then a live database or
   browser smoke only when the lower layer cannot exercise the behavior.
3. Reuse the live harness. TypeScript tests run through root `vitest.config.ts`;
   Rust unit tests sit beside private logic; cross-module Rust tests sit under
   `apps/desktop/src-tauri/tests`; browser boot coverage extends the existing
   smoke rather than creating another server launcher.
4. Make the test fail for the reported bug before accepting the fix whenever
   practical. Assert the externally meaningful state, payload or side effect.
5. Run a focused test while iterating, then run the exact gate that CI uses for
   that layer. Feature-gated and live-database behavior needs its additional
   command; a green default run does not cover it.
6. When changing CI, keep installation, cache, job dependency and cleanup
   behavior explicit. Verify the workflow still fails when the intended gate
   fails.

## Invariants

**Root `vitest.config.ts` is the live TypeScript test configuration.** It
discovers centralized tests under `__tests__`, colocated tests under package and
app `src`, uses globals and `happy-dom`, and loads
`__tests__/vitest.setup.ts`. Both the desktop and studio package test scripts
pass this config explicitly. Do not update a package-local config and claim the
suite changed.

**Use a project script, not Bun's built-in test runner.** `bun run test:desktop`
is the TypeScript test command in PR CI. `bun run --cwd packages/studio test`
and `bun run --cwd apps/desktop test` also invoke Vitest with the root config.
A bare `bun test` selects a different runner and is not evidence for the
configured suite.

**Package labels do not scope the discovered tests.** Because both package
scripts point at the same root config and its include globs span the repository,
the studio and desktop commands currently discover the same TypeScript test
set. To run one file, pass a path or name to Vitest; do not infer isolation from
the package working directory.

**React aliases in the root config are load-bearing.** The harness and studio
can otherwise resolve separate React copies and fail with an invalid-hook-call
error. React, ReactDOM, Testing Library, React Query and React Router are pinned
to the studio dependency graph. Preserve `resolve.dedupe` and those aliases
when changing test resolution.

**Shared setup owns DOM cleanup and browser-global shims.**
`__tests__/vitest.setup.ts` loads jest-dom matchers, runs Testing Library
cleanup after every test and supplies localStorage when the environment does
not. A test may reset data it writes, timers it fakes and mocks it installs, but
must not register a competing global cleanup file for one feature.

**Tests are deterministic and offline by default.** Unit tests do not call live
provider APIs, depend on a developer's credential store, use the user's real
filesystem, or assume a local database server. Inject readers and adapters,
decode recorded provider payloads, use temporary directories and in-memory
databases, and restore process/global state after the test.

**Test the public behavior at the narrowest boundary that observes it.** Pure
transformations such as parsers, cache keys, reducers and SQL builders take
table-driven inputs. React tests exercise visible state and user intent rather
than component internals. Rust service tests assert typed results and durable
state. Command-registration tests prove a command exists but do not replace a
service behavior test.

**Mocks implement the same boundary as production.** Frontend data behavior
uses `DataAdapter`; browser-only Studio runs use the mock adapter; direct Tauri
operations mock the generated command wrapper or inject a pure boundary.
Do not reach around a boundary in a test just because constructing its real
implementation is inconvenient.

**Regression tests preserve the bug's shape.** Keep the smallest input that
would have failed before the fix, and assert the semantic outcome. Do not weaken
an assertion, replace it with a snapshot or update expected output merely to
make a changed implementation green unless the product contract intentionally
changed.

**Rust unit tests stay beside private logic; integration tests use the public
crate.** A `#[cfg(test)] mod tests` can reach private helpers and is appropriate
for parsers, quoting, state machines and serialization. Files under
`apps/desktop/src-tauri/tests` compile as separate crates and are appropriate
for public command registration, storage boundaries and cross-module behavior.
Async work uses `#[tokio::test]`.

**`cargo test` means default features only.** The crate's default feature set is
empty. DuckDB's in-process backend and its tests require
`cargo test --features duckdb-engine`; PR CI does not run that command. Any
change under feature-gated DuckDB code is unverified until both configurations
compile and the feature run passes.

**Real database tests are opt-in and currently cover MySQL-family writes.**
`apps/desktop/src-tauri/tests/live_db_tests.rs` checks
`DORA_LIVE_DB_TESTS=1`; the weekly/manual workflow starts MySQL on host port
3307 and MariaDB on 3306 from `docker-compose.databases.yml`, runs the insert →
update → delete → truncate adapter lifecycle, and always tears the containers
down. Plain `cargo test` executes those functions as successful skips.

**Do not claim engine parity from the live harness.** The live workflow does not
exercise Postgres, CockroachDB, libSQL, D1, PostHog or DuckDB. Regular Rust CI
does start a Postgres service and provides `DATABASE_URL`, but that is not the
cross-engine lifecycle suite. Engine verification scope belongs to
`dora-database-parity`.

**The boot smoke is a browser integration check, not a Tauri end-to-end test.**
`packages/studio/smoke/boot-smoke.mjs` launches Chromium against the desktop
Vite app using the mock adapter, asserts the database grid and Monaco SQL path,
fails on page errors and non-allowlisted console errors, captures a screenshot
on failure and stops the server it started. It catches blank-window and browser
composition regressions; it proves nothing about Rust IPC or native packaging.

**The smoke's error allowlist stays short and causal.** An allowlist entry is a
hole in the gate. Add one only for a understood, unavoidable message and match
it narrowly; never suppress all errors from a library or page.

**Coverage is diagnostic, not a merge gate.** `bun run test:coverage` uses V8
and writes text, JSON and HTML under the generated .cache/coverage directory.
There is no configured threshold and CI does not run it. Report coverage
numbers as observations, not as a pass/fail contract.

**PR CI has five independent proofs and an ordered build.**
`.github/workflows/ci.yml` runs TypeScript tests, default-feature Rust tests,
lint plus `skills:check`, both TypeScript typechecks, and the Playwright boot
smoke. The desktop build waits for tests, Rust, lint and typecheck; the smoke
waits for TypeScript tests, lint and typecheck. Do not fold independent failures
into a script that can mask which gate failed.

**Workflow actions stay pinned.** Existing actions use full commit SHAs and Bun
is pinned to the repository's package-manager version. New or upgraded actions
follow the same supply-chain convention; version drift is an explicit change.

**Cleanup runs even after failure.** Live database containers stop under
`if: always()`. Browser and temporary-resource tests use `finally`, teardown
hooks or owning guards so a failing assertion does not leave processes, files,
ports or durable user state behind.

## Known gaps

- Centralized and colocated TypeScript test conventions conflict.
- Three setup/config files are dead, and their existence makes the canonical
  harness easy to misidentify.
- Root Turbo testing may execute the same shared Vitest suite more than once.
- There is no coverage threshold or coverage job.
- DuckDB feature tests are absent from PR CI.
- Live adapter CI covers only MySQL and MariaDB and runs weekly or manually.
- The boot smoke uses a web mock and does not launch the Tauri binary.
- No single command proves all operating-system-specific behavior.

## Common mistakes

- Adding a test to a path the root include globs do not discover.
- Editing `apps/desktop/vitest.config.ts` and expecting CI to use it.
- Running bare `bun test` and reporting the configured Vitest suite green.
- Removing the studio dependency aliases and reintroducing two React instances.
- Leaving localStorage, fake timers, global mocks or module state dirty for the
  next test.
- Mocking the implementation under test instead of its external boundary.
- Updating a snapshot or expected string to accept a regression without naming
  the intended behavior change.
- Calling default `cargo test` sufficient for DuckDB.
- Calling the live database suite cross-engine parity coverage.
- Adding network-dependent tests to the PR path.
- Treating the browser smoke as proof that a Tauri command works.
- Adding a broad console-error allowlist to make the smoke green.
- Changing CI job dependencies so the build can publish confidence without its
  required gates.

## Verification

Use the commands that match the change.

TypeScript and React:

```bash
bun run test:desktop
bun run --cwd packages/studio typecheck
bun run --cwd apps/desktop typecheck
bun run lint
```

Rust:

```bash
cargo test
cargo test --features duckdb-engine
```

Run Rust commands from `apps/desktop/src-tauri`.

Browser boot:

```bash
bun run --cwd packages/studio smoke
```

Start and stop the live MySQL and MariaDB services from the repository root:

```bash
docker compose -f docker-compose.databases.yml up -d --wait mysql mariadb
docker compose -f docker-compose.databases.yml down -v
```

Between those commands, run
`cargo test --test live_db_tests -- --nocapture` from
`apps/desktop/src-tauri` with `DORA_LIVE_DB_TESTS=1` set for the process. The
scheduled workflow is the reproducible CI form and handles cleanup even after
failure.

## Definition of done

- The test names the invariant or failure mode and fails for the old behavior
  when practical.
- It runs under the live harness and leaves global, process, filesystem and
  database state clean.
- Mocks stop at a real production boundary and the assertion observes public
  behavior.
- The focused test and the exact CI gate for its layer pass.
- DuckDB changes pass the feature-enabled Rust run; live adapter changes pass
  the env-enabled database suite.
- CI changes preserve pinned actions, explicit job dependencies and failure-safe
  cleanup.
- Verification claims name what was not exercised.

See `reference.md` for the runner map, discovery patterns, CI job matrix,
feature/live coverage and representative test locations.

# Testing reference

## Live runner map

| Surface | Command | Configuration | Scope |
| --- | --- | --- | --- |
| CI TypeScript | `bun run test:desktop` | Root `vitest.config.ts` | All matching repository TypeScript tests |
| Studio package | `bun run --cwd packages/studio test` | Root `vitest.config.ts` | Same discovery globs |
| Desktop package | `bun run --cwd apps/desktop test` | Root `vitest.config.ts` | Same discovery globs |
| Root workspace | `bun run test` | Turbo `test` task | Runs workspace package test scripts |
| Coverage | `bun run test:coverage` | Root Vitest, V8 | Diagnostic reports under the generated coverage directory |
| Rust default | `cargo test` | Empty default feature set | Unit and integration tests, not in-process DuckDB |
| Rust DuckDB | `cargo test --features duckdb-engine` | DuckDB feature | Includes feature-gated backend/tests |
| Browser smoke | `bun run --cwd packages/studio smoke` | Playwright Chromium | Web Studio with mock adapter |
| Live adapters | `cargo test --test live_db_tests -- --nocapture` | Environment-gated | MySQL and MariaDB mutation lifecycle |

Run Cargo commands from `apps/desktop/src-tauri`.

## Vitest discovery

Root `vitest.config.ts` includes:

- `__tests__/**/*.test.{ts,tsx}`
- `packages/*/src/**/*.test.{ts,tsx}`
- `apps/*/src/**/*.test.{ts,tsx}`

It excludes dependency and distribution directories, uses `happy-dom`, enables
globals, and loads `__tests__/vitest.setup.ts`.

The live setup supplies jest-dom, Testing Library cleanup and a localStorage
fallback. React-related aliases point at `packages/studio/node_modules` to keep
one React instance.

Three legacy package-local setup/configuration files were removed because they
did not participate in the live command. Keep the root configuration and root
setup as the single Vitest authority.

## Choosing a test layer

| Behavior | Preferred layer |
| --- | --- |
| Pure parser, formatter, reducer, cache key or SQL builder | Table-driven Vitest or Rust unit test |
| Hook/store state transition | Vitest with the real provider boundary and controlled external adapter |
| User interaction and visible state | Testing Library with user-event |
| Private Rust helper/state machine | Colocated `#[cfg(test)]` module |
| Public Rust cross-module/storage behavior | File under `apps/desktop/src-tauri/tests` |
| Real driver semantics | Environment-gated live database test |
| Browser composition/blank-window risk | Existing Playwright boot smoke |
| Native Tauri IPC/package behavior | Manual/native harness; web smoke is insufficient |

## Rust test categories

Colocated unit tests cover parser behavior, identifier quoting, row writers,
dialect/capability resolution, connection and statement state machines, storage
helpers, provider response decoding and security transforms.

Integration-test crates under `apps/desktop/src-tauri/tests` cover public
surfaces such as:

- command registration;
- credentials and security;
- build-cache behavior;
- DuckDB IPC;
- live-monitor commands;
- SQLite parser and MySQL metadata helpers;
- opt-in live database adapter behavior.

`apps/desktop/src-tauri/src/database/duckdb/save_session.rs` and other in-process
DuckDB modules are compiled and tested only with `duckdb-engine`.

## Live database matrix

| Engine | Compose host port | Automated lifecycle coverage |
| --- | ---: | --- |
| Postgres | 5432 | Not in `live_db_tests.rs`; regular Rust CI supplies a service |
| MySQL | 3307 | Weekly/manual insert, update, delete, truncate |
| MariaDB | 3306 | Weekly/manual insert, update, delete, truncate |
| CockroachDB | 26257 | None in the live workflow |
| libSQL | 8081 | None in the live workflow |
| DuckDB | local | Feature-gated tests, not live workflow |
| D1 | remote HTTP | Offline unit tests only |
| PostHog | remote HTTP | Offline unit tests only |

The workflow starts only MySQL and MariaDB and sets
`DORA_LIVE_DB_TESTS=1`. The test functions otherwise return successful skips.

## Pull-request CI

| Job | Primary proof | Depends on |
| --- | --- | --- |
| `test-typescript` | `bun run test:desktop` | none |
| `test-rust` | Default and DuckDB-feature Cargo tests, generated-binding drift check, Postgres service available | none |
| `lint` | Style lint and `skills:check` | none |
| `typecheck` | Studio and desktop TypeScript projects | none |
| `build` | Desktop Vite build | TypeScript tests, Rust tests, lint, typecheck |
| `boot-smoke` | Chromium grid and SQL-console scenarios | TypeScript tests, lint, typecheck |

The live database workflow is separate: manual dispatch plus a Monday cron. It
is not a pull-request dependency.

## Boot smoke contract

`packages/studio/smoke/boot-smoke.mjs`:

1. reuses a server at port 1420 or starts the desktop Vite app;
2. launches Chromium with a fixed desktop viewport;
3. opens the demo Database Studio and waits for a rendered cell;
4. opens the SQL console, types and executes a query, and waits for a result;
5. records page and console errors;
6. writes `packages/studio/smoke-artifacts/boot-smoke-failure.png` on failure;
7. closes the browser and any server it owns.

It uses the web mock adapter and does not exercise the Tauri backend.

## Evidence language

Use precise handoff language:

- "TypeScript suite passed" after `bun run test:desktop`.
- "Default-feature Rust suite passed" after `cargo test`.
- "DuckDB feature suite passed" only after the feature-enabled command.
- "MySQL/MariaDB live lifecycle passed" only with the environment-enabled
  integration test.
- "Browser boot smoke passed against the mock adapter" for the Playwright run.

Never shorten one of those to "all tests passed" when a relevant category was
not run.

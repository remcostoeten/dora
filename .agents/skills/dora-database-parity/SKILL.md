---
name: dora-database-parity
description: What must hold across every database Dora supports. Use when adding or changing behaviour that reads or writes user data, introspects a schema, emits or parses SQL, dumps or exports, or is gated per engine — a new adapter method, a mutation, a capability flag, or a feature only some engines can do — and when deciding which engines a data-facing change must be verified against before it ships. Not for presentation-only work with no engine-dependent behaviour (styling, layout, copy, icons, keyboard, grid rendering), and not for wiring a brand-new engine through the registries (dora-add-database-driver).
---

# Database parity

## Scope

This skill owns the cross-engine contract: which behaviours already differ,
how a capability is declared and consumed end to end, how a feature degrades
where an engine cannot support it, where engine-specific code may live, and what
must be verified before a data-facing change is called done.

Query lifecycle is `dora-query-pipeline`'s, the IPC surface is
`dora-tauri-boundary`'s, grid rendering is `dora-data-grid`'s, and connecting,
secrets and teardown are `dora-connection-lifecycle`'s. Adding an engine is
`dora-add-database-driver`'s — this skill is what that work is checked against.
Nothing here restates them.

## Unencodable

Source has two or more answers and `.agents/skills/FINDINGS.md` declines to pick
one. Ask before deciding.

- Which capability table owns a new flag that both the backend and the UI need.
  Two `SourceCaps` types exist with the same name and different contents
  (FINDINGS 4.4). Rules below describe each table's existing consumers only.
- Which engine enum a new per-engine branch switches on; four overlap
  (FINDINGS 4.5).
- Which result path a new data-reading feature should use (FINDINGS 4.6), and
  which side composes browse SQL (FINDINGS 4.7).

## Workflow

1. Establish the blast radius: which of the seven drivers can reach the code you
   are changing. A change behind a `WriteAdapter`, `DatabaseAdapter` or
   `WatchAdapter` method reaches all of them.
2. Read `reference.md` for what already differs there. Do not re-derive it, and
   do not assume a behaviour is uniform because one engine has it.
3. Implement the capable engines in their own per-engine module or adapter impl.
4. Implement the incapable ones explicitly — a returned error, never a missing
   arm, a `todo!`, or a silent success.
5. Turn the affordance off for the incapable ones in the capability table so the
   user does not reach the error, and explain the hole if it is user-visible.
6. Verify against the matrix below and state, in the PR, which engines were
   exercised and which were not.

## Invariants

**Count seven drivers and two dialect deltas, not nine engines.** The contract
surface is nine — the `DatabaseInfo` variants in
`apps/desktop/src-tauri/src/database/types.rs` and the `DatabaseType` union in
`packages/studio/src/features/connections/types.ts`: Postgres, CockroachDB,
MySQL, MariaDB, SQLite, DuckDB, libSQL, Cloudflare D1, PostHog. The code paths
are seven: `DatabaseClient` and `adapter::DatabaseType` collapse CockroachDB
into the Postgres driver as a `PgDialect` and MariaDB into the MySQL driver as a
`MySqlDialect`. Parity work is done per driver; vendor deltas are done per
dialect.

**A dialect delta overrides the queries that differ, not the code path that runs
them.** `PgIntrospection::COCKROACH` and `MySqlIntrospection::MARIADB` in
`apps/desktop/src-tauri/src/database/dialect.rs` restate only the constants they
change and inherit every `VANILLA_*` one. A vendor difference that makes you
fork a function has been modelled at the wrong tier.

**Runtime detection decides the dialect, never the user's pick.** The `dialect`
field is overwritten from `SELECT version()` / `SELECT VERSION()` at connect
time, and `SourceCaps::for_dialect` derives capability from that. Gate on the
resolved capability, never on the variant the user chose in the dialog.

**Behaviour differences are enumerated, not discovered.** The differences that
exist today — read-only sources, mutation methods missing per engine, blob
readback, value-constraint dropdowns, live monitoring, identifier quoting,
schema qualification, statement parsing, DuckDB being compiled out — are listed
in `reference.md`. Add a row there in the same change that creates a new one; a
difference nobody wrote down is the one that ships broken.

**A capability is a table entry consumed through a helper, never an inline
engine check.** In the studio, add the field to `SourceCaps` and fill it for
every key of `ENGINE_CAPS` in
`packages/studio/src/features/connections/source-caps.ts` — the `Record<DbEngine,
SourceCaps>` type makes the compiler demand all nine. Read it through
`getSourceCaps`, which is also where a DuckDB data-file session gets its
overrides applied. Map it to a UI affordance by adding a `StudioUiAction` in
`packages/studio/src/features/connections/ui-actions.ts` and asking
`isUiActionVisible`; components must not read the raw flag to decide visibility.
Export the new symbol from
`packages/studio/src/features/connections/source-metadata.ts` and pin it in
`__tests__/source-caps.test.ts`. In the backend, a flag that gates backend
behaviour is a field on the Rust `SourceCaps` in
`apps/desktop/src-tauri/src/database/dialect.rs`, filled in `for_dialect` for
every `DetectedDialect` and read through `DatabaseConnection::source_caps()` —
which is how the live monitor first admits/refuses an engine and then decides
between push and polling.

**An engine that cannot do something returns an error; the factory match stays
total.** Every per-driver factory is an exhaustive match, so a missing engine is
a compile error by construction — keep it that way. The refusal itself is one of
two shapes, and they are not interchangeable: `Error::NotImplemented("<method>
for <engine>")` means "this engine could, but Dora does not do it yet", and a
plain friendly sentence — the `read_only()` helper in
`apps/desktop/src-tauri/src/database/adapter/write_posthog.rs` — means "this
source is permanently read-only". Never `todo!`, never panic, never return a
success shape that did nothing.

**The string inside `NotImplemented` is user-visible copy.** `formatBackendError`
in `packages/studio/src/shared/utils/backend-error.ts` surfaces `detail`
verbatim, so the argument must read as a sentence fragment in the existing
`"WriteAdapter::truncate_database for MySQL"` shape: the capability, then the
engine.

**Degrade by hiding the affordance, then explain the hole.** The error is a
backstop, not the user experience: turn the flag off so the button never renders,
and when the absence is conspicuous, ship a message constant beside a predicate
that decides when to show it — `DATA_FILE_READONLY_MESSAGE` with
`shouldShowDataFileReadonlyMessage` in
`packages/studio/src/features/connections/source-labels.ts` is the pattern, and
`SourceBadges` is where a permanent limitation gets a badge. A silently missing
button with no explanation is not a degradation, it is a bug report.

**Engine identity may parameterise SQL; it may not decide whether a feature
exists.** Allowed: the per-engine modules under
`apps/desktop/src-tauri/src/database`, the per-driver adapter impls and their
factories, the dialect introspection profiles, the quoting helpers in
`apps/desktop/src-tauri/src/database/ident.rs` and
`packages/studio/src/shared/utils/table-ref.ts`, and SQL emitters and parsers
that take a dialect as an argument, such as
`packages/studio/src/features/orm-cockpit/converters/emit-sql.ts`. Forbidden:
`docs/architecture/data-sources.md` states that feature code must not branch on
engine or dialect identity — concretely, a `connection.type === '<engine>'` check
in a component or hook to decide what to render, and a `match` on the engine
inside a service that already holds an adapter.

**Generated SQL goes through the quoting helpers, always.** Identifiers reach us
from live introspection and from the webview, so ANSI double quotes for
Postgres, CockroachDB, SQLite, libSQL, D1 and DuckDB, backticks for MySQL and
MariaDB, through `quote_ansi` / `quote_mysql` / `qualified_ansi` /
`qualified_mysql` on the Rust side. Interpolating a raw identifier is both a
parity bug and an injection.

**Verify against every family the change can reach, and name the ones you could
not.** The floor, derived from what the repository actually runs:

- `cargo test` from `apps/desktop/src-tauri` for any backend change. It covers
  the SQLite family in process, the dialect and capability tables, quoting and
  parsing — and it runs with default features.
- DuckDB is behind the non-default `duckdb-engine` feature, so a DuckDB change is
  unverified until `cargo test --features duckdb-engine` runs. CI never compiles
  it.
- MySQL and MariaDB are the only engines with a live-server harness, and it is
  not part of `cargo test` or `bun run test:desktop`. `AGENTS.md` has the servers
  and the invocation.
- libSQL, Cloudflare D1 and PostHog have no automated coverage. A change that
  reaches them is manual, and the PR says so.
- `bun run test:desktop` for anything touching the capability tables, source
  metadata, quoting or data-file health.

**A parity claim needs an assertion, not a paragraph.** The capability tables are
pinned by `__tests__/source-caps.test.ts` and the dialect caps by the tests in
`dialect.rs`. A new flag or a new dialect delta lands with a case in one of them.

## Known gaps

State these as gaps; do not write around them as if they were solved.

- Nothing checks behavioural parity. The exhaustive matches and the
  `Record<DbEngine, ...>` types force every engine to be *mentioned*; no test
  asserts that two engines behave the same.
- Live adapter coverage is still absent for libSQL, D1 and PostHog.
- `Error::NotImplemented` reaches the user as raw text; there is no mapping in
  `formatBackendError` that turns it into engine-aware copy.

## Common mistakes

- Treating the nine contract variants as nine implementations, or forgetting
  that CockroachDB and MariaDB are dialects of drivers you already changed.
- Adding an adapter method that works on one engine and leaving the others to
  the trait default or an unreachable arm.
- Using `NotImplemented` for a permanently read-only source, or a read-only
  message for something merely unbuilt.
- Shipping a refusal with no capability flag, so the user finds it by clicking.
- Turning a flag off and shipping no explanation for the missing affordance.
- Filling a new `SourceCaps` field for the engines you care about and copying a
  neighbour's value for the rest without checking.
- Reading a capability flag directly in a component instead of through
  `isUiActionVisible`.
- Branching on `connection.type` in feature code instead of asking the caps.
- Forking a whole function for a vendor difference that belongs in an
  introspection profile.
- Interpolating an identifier into generated SQL without the quoting helpers.
- Calling a DuckDB change verified after a default-feature `cargo test`.
- Claiming cross-engine coverage from a run that only exercised SQLite.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
cargo test --features duckdb-engine
```

From the repository root:

```bash
bun run test:desktop
bun run --cwd packages/studio typecheck
bun run lint
```

For MySQL and MariaDB against real servers, use the live harness documented in
`AGENTS.md`; it is the only live coverage that exists.

## Definition of done

- Every driver the change can reach either implements the behaviour or refuses
  it explicitly, in the shape that matches why it cannot.
- Every refusal a user could hit is preceded by a capability flag that hides the
  affordance, and a conspicuous absence is explained.
- A new capability flag is filled for every key of its table, consumed through
  the existing helper, and asserted in a test.
- No new engine-identity branch outside the per-engine modules, the adapter
  impls and factories, the dialect profiles, or a dialect-parameterised SQL
  emitter.
- Generated SQL quotes identifiers through the helpers.
- `reference.md` gains a row for any difference this change creates.
- `cargo test` and `bun run test:desktop` pass; DuckDB changes also pass
  `cargo test --features duckdb-engine`; engines with no coverage are named in
  the PR.

See `reference.md` for the per-engine difference matrix, the per-driver write
support table, and where each capability table is read today.

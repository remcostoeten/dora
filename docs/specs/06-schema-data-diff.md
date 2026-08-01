# Spec 06: Schema + Data Diff Between Connections

Status: `[-]` schema-diff engine + DDL generation shipped (schema-file ↔ live DB); connection-to-connection diff and Phase 2 data diff still open.

> **Update (2026-06-20).** The diff engine and migration generation from Phase 1 shipped as part of the **ORM cockpit** (#151–#155): a confidence-aware `SchemaDiff` plus a `SchemaDiff → up/down DDL` generator (dialect-correct, destructive/review statements gated behind opt-in), surfaced as a per-table drift view and a read-only migration preview. **Caveat:** the cockpit diffs a parsed Drizzle/Prisma **schema file against the live database**, not **two live connections** as specced here. The connection-vs-connection picker and the **Phase 2 data diff** (row-level, PK-keyed) are still unbuilt. The reusable pieces live in `packages/studio/src/features/orm-cockpit/` (`diff/`, `migration/generate-sql.ts`).

## Why

"What's different between dev and prod?" is a daily question with no good GUI answer: existing tools are SaaS (Datafold) or CLI (migra, atlas). Dora already holds both connections and their metadata, so an in-app diff is a natural superiority play over TablePlus/DBeaver.

## Scope (two phases, one agent)

### Phase 1: Schema diff

- Pick two connections (or two databases/schemas on one connection) of the **same provider family**; cross-provider diff is out of scope.
- Diff tables, columns (type/nullability/default), primary keys, indexes, foreign keys. Output: a tree view (added / removed / changed, drill into per-column detail) plus a generated **sync DDL script** (target ← source) shown in a read-only Monaco buffer with copy/export. Dora does not auto-apply it in v1.

### Phase 2: Data diff

- For a selected table present in both connections: row-level diff keyed on primary key, covering added / removed / changed rows, with a column-level changed-cell view reusing the data viewer grid.
- Guard rails: refuse tables without a PK (offer column-set key selection), cap at a configurable row limit (default 100k) with a clear "table too large, add a filter" path; support a WHERE filter input applied to both sides.

Out of scope: applying sync DDL automatically, data sync/merge writes, scheduled diffs, cross-provider type translation.

## Safe write scope

- Backend: new `apps/desktop/src-tauri/src/database/diff/` module + `database/commands/diff.rs` (+ registration in `commands/mod.rs`, `lib.rs`)
- Frontend: new `packages/studio/src/features/diff/` feature, entry points from the connection context menu and command palette (`packages/studio/src/features/command-palette/`)
- Read-only reuse of `database/services/metadata.rs` and the schema introspection per provider. Extend the metadata structs only additively if a needed attribute (e.g. column default) is missing.

## Implementation notes

1. Build the diff on a normalized schema model (provider-agnostic structs) derived from existing introspection output; the comparison itself must contain zero provider-specific code. DDL *generation* is per-dialect: start with Postgres + MySQL families, return "DDL generation not yet supported" for others while still showing the visual diff.
2. Type equality needs normalization rules per family (e.g. Postgres `varchar` vs `character varying`, MySQL display widths). Keep these rules in a table-driven module with unit tests, since this is where the bugs will live.
3. Data diff strategy: stream both sides ordered by key and merge-join client-side. Do not load both tables into memory unbounded; respect the row cap. Hash rows (stable serialization via the existing row_writer output) to detect changes cheaply, then fetch full rows only for changed keys.
4. Sync DDL ordering matters: drops after adds for dependent objects, FKs last. Emit the script in dependency-safe order and mark destructive statements (`DROP …`) with a leading comment block so a human reviews them.
5. Diff runs can be slow, so run them through the same async/cancellation pattern as long queries so the UI stays responsive and cancellable.

## Done when

- Schema diff between two Docker Postgres databases with deliberate drift shows correct added/removed/changed objects and produces sync DDL that, applied manually, makes a follow-up diff come back clean (this round-trip is an integration test).
- Same round-trip for MySQL.
- Data diff on a 100k-row table with seeded differences finds exactly the planted adds/removes/changes; PK-less tables get the key-selection flow.
- Unit tests for type normalization and DDL ordering.

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
# manual: two docker postgres containers seeded with drifted schemas via the Docker manager
```

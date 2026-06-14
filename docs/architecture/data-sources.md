# Data Source Architecture — Models, Engines, Dialects

Status: design locked (2026-06-14). Drives the dialect-parity work and all future
data-source support (new SQL dialects, serverless vendors, and entirely new database
models — document / key-value / columnar / graph).

## The problem

"Which database is this?" currently has three conflated answers:

1. `Database::CockroachDB` / `Database::MariaDB` — backend connection-state *variants*,
   peers of `Postgres`/`MySQL` (wrong: they are not different wire engines).
2. `detected_dialect` — a runtime field added for version detection.
3. Frontend `DbPreset` (neon, supabase, cockroach, planetscale, turso…) — already correct.

This does not scale: the modern market is dominated by wire-compatible vendors. Modeling
each as a top-level engine variant leads to `Database::Neon`, `Database::Supabase`,
`Database::Aurora` — absurd. They are the **same Postgres engine with a label**.

## The model: three tiers + one capability descriptor

```
Tier 1  MODEL / PARADIGM   relational | document | key-value | columnar | graph | search | timeseries
Tier 2  ENGINE / WIRE      postgres | mysql | sqlite | duckdb | libsql | (future: mongo | redis | clickhouse)
Tier 3  DIALECT / VENDOR   vanilla | cockroach | neon | supabase | aurora-pg ; mariadb | planetscale | tidb ; turso
```

- **Model** drives capability *defaults* and which UI affordances exist at all
  (a document store has no rows-grid edit; a KV store has no schema tree).
- **Engine** is the wire protocol → one `DatabaseAdapter` / `WriteAdapter` impl.
  Adding MongoDB/ClickHouse is *additive* here.
- **Dialect** is a vendor flavor *within* an engine → a `DialectProfile`. Most profiles
  are pure metadata (Neon/Supabase/Aurora/PlanetScale = free); a few (Cockroach, Redshift,
  TiDB) carry introspection-query and type-mapping overrides.

### Capabilities are the routing mechanism (the enterprise bit)

Feature code MUST NOT branch on engine/dialect identity. It asks the **resolved
capability descriptor**:

```
Capabilities {
  // paradigm
  queryLanguage: 'sql' | 'mql' | 'redis' | ...
  resultShape:   'rows' | 'documents' | 'keyvalue' | 'graph'
  // surface (already on the frontend SourceCaps)
  canRunSql, canInspectSchema, canEditRows, canImportFile, canExportFile,
  canQueryFiles, canAttachFiles, supportsLocalFile, supportsRemoteUrl,
  supportsSshTunnel, supportsLiveMonitor, isReadonly
  // dialect deltas
  supportsListenNotify, supportsTransactions, supportsExplainJson, ...
}
```

Resolution layers: **model defaults → engine overrides → dialect overrides**. Adding a
new model = define its defaults + the UI branches on `resultShape`. Nothing else rewrites.

### Single source of truth for capabilities

Caps are currently defined twice — frontend `source-caps.ts` (`ENGINE_CAPS`) and backend
`dialect.rs` (`SourceCaps`). They will drift. **Backend is canonical**; it resolves caps
for a (model, engine, dialect) and surfaces them to the frontend via a binding. The
frontend keeps only presentation (labels/icons/presets).

## Backend target shape

`DatabaseType` (adapter engine id) — **already correct**, keep as-is:
`Postgres | MySQL | SQLite | DuckDB | LibSQL`.

`Database` (connection state) — remove the dialect peer-variants, dialect becomes a field:

```rust
Database::Postgres { client, use_simple_query, dialect: PgDialect, .. }   // was: + CockroachDB variant
Database::MySQL    { client, dialect: MySqlDialect, .. }                  // was: + MariaDB variant
// SQLite / DuckDB / LibSQL unchanged
```

`PgDialect` / `MySqlDialect` (in `dialect.rs`) — enum-as-strategy (closed, vendor-controlled
set → enum, not a trait; exhaustive matches give compiler-enforced completeness):

```rust
impl PgDialect {
    fn profile(&self) -> &'static DialectProfile;   // metadata + caps deltas
    fn introspection(&self) -> PgIntrospection;     // query overrides; defaults to vanilla
    fn map_type(&self, t: &Type) -> Option<Display>;// type overrides; None ⇒ base path
}
```

Default dialect = `Vanilla`; `detect_pg_dialect`/`detect_mysql_dialect` set it at connect.
Adapters (`PostgresAdapter`/`MySqlAdapter`) carry the dialect field — mirrors the existing
`use_simple_query` precedent — and pass it into `get_schema` + the row writer.

### Why enum-as-strategy, not a trait or parallel modules
- Closed set we ship (no third-party plugins) → enum beats trait (no dispatch/ceremony).
- Exhaustive match: add `PgDialect::Yugabyte` → every arm fails to compile until handled.
- Parallel `cockroachdb/` modules would duplicate ~90% of working Postgres code.

## Frontend
Already engine/preset-aware (`DbEngine`, `DbPreset`, `SourceMeta`, `SourceCaps`). Keep
`Connection.type` as the user-facing id; the binding/conversion layer bridges
frontend `type='cockroach'` → backend `engine=postgres, dialect=Cockroach`. Cleaning the
frontend `DatabaseType` to drop cockroach/mariadb is a *later, optional* tidy — not blocking.

## What this unlocks (in cost order)
- **Free** (metadata-only profiles): Neon, Supabase, Aurora-PG, AlloyDB, Timescale,
  PlanetScale, Aurora-MySQL — label + preset + caps, zero introspection code.
- **Cheap** (a few overrides): CockroachDB, MariaDB, YugabyteDB, TiDB.
- **Most** (heavy overrides, still same engine): Redshift, Greenplum, SingleStore.
- **New adapter** (separate effort, unaffected by this): MongoDB, ClickHouse, SQL Server,
  Snowflake — implement `DatabaseAdapter`, define a model + caps, UI routes on `resultShape`.

## Non-goals (now)
- No new database engines in this work (Mongo/ClickHouse are future, additive).
- No premature generalization of the adapter trait — the capability layer is the seam that
  makes a future non-relational adapter additive.
</content>
</invoke>

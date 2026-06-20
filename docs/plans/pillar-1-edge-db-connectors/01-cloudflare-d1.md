# Plan: Cloudflare D1 connector

**Tier:** land-grab. **Effort:** M–L. **Blocks:** none. **Depends on:** none.

> Strategic note: there is no good desktop GUI for D1, and CF devs are squarely
> the ICP. This is the highest-upside connector. **But it is not "just SQLite":**
> D1 is queried over a JSON REST API, so it needs a dedicated HTTP query
> adapter. The `libsql::Builder::new_remote` path speaks Hrana/Turso, **not** the
> D1 REST API, so we cannot reuse it. This plan has two halves: (A) a new D1
> query adapter, (B) the connect-flow. Read
> `00-provider-integration-pattern.md` first for half B.

## D1 REST API facts

- Query endpoint: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query`
  with `Authorization: Bearer <api_token>`, body `{ "sql": "...", "params": [...] }`.
  Response: `{ "result": [ { "results": [ {col: val, …}, … ], "success": true,
  "meta": { "changes", "last_row_id", "duration", … } } ], "success": true,
  "errors": [...] }`. Multiple statements may return multiple result objects.
- List DBs: `GET /accounts/{account_id}/d1/database` → `{ result: [ { uuid, name,
  … } ] }` (paginated via `?page=&per_page=`).
- List accounts: `GET /accounts` → `{ result: [ { id, name } ] }`.
- Token verify / identity: `GET /user/tokens/verify` (works for the account
  token) and `GET /accounts` gives the account label for "Connected as …".
- D1 SQL dialect = SQLite. So **schema introspection + SQL parsing can reuse the
  SQLite logic** (`PRAGMA`/`sqlite_master` queries), executed over HTTP.

## Half A — new D1 query adapter (Rust)

### A1. New engine type
- `packages/studio/src/features/connections/types.ts`: add `'d1'` to
  `DatabaseType` and a `DEFAULT_PORTS['d1'] = 0` (embedded/remote, no port).
  *(SHARED, append-only.)*

### A2. Connection model carries D1 coordinates
A D1 connection needs `account_id`, `database_id`, and the API token. Reuse the
existing `Connection` fields: put the token in `authToken`, and encode account+db
in `url` as `d1://{account_id}/{database_id}` (parse it back in Rust). Document
this in the connect-flow's `onComplete`.

### A3. `DatabaseClient` variant
`apps/desktop/src-tauri/src/database/types.rs` (the `DatabaseClient` enum, ~L189):
add
```rust
D1 { http: Arc<crate::database::d1::D1Http> },
```
where `D1Http` holds a `reqwest::Client`, `account_id`, `database_id`, `token`.

### A4. New module `apps/desktop/src-tauri/src/database/d1/`
- `mod.rs` — `pub struct D1Http { … }` with `async fn query(&self, sql, params)
  -> Result<Vec<D1ResultSet>>` hitting the REST endpoint; map `errors[]` to a
  clear `Error`.
- `execute.rs` — implement the `DatabaseAdapter` trait
  (`apps/desktop/src-tauri/src/database/adapter/read.rs` L38–58):
  - `parse_statements` — reuse the SQLite statement splitter (it's the SQLite
    dialect). Look at how `SqliteAdapter` does this and share the helper.
  - `execute_query` — send SQL to `D1Http::query`, stream rows back through the
    `ExecSender` exactly like other adapters (study `SqliteAdapter::execute_query`
    for the row/column shaping).
  - `get_schema` — run the **same introspection SQL** the SQLite schema reader
    uses (`apps/desktop/src-tauri/src/database/sqlite/schema.rs`) but over HTTP.
    Factor the SQLite introspection SQL strings into a shared place if needed so
    both adapters use them.
  - `database_type` → `DatabaseType::D1` (add this enum member in
    `database/types.rs` Rust-side `DatabaseType` too).
- `schema.rs` — if introspection is non-trivial, isolate it here.

### A5. Dispatch
- `apps/desktop/src-tauri/src/database/adapter/read.rs` `adapter_from_client()`
  (~L337): add a `DatabaseClient::D1 { http } => Box::new(D1Adapter::new(http.clone()))`
  arm.
- `apps/desktop/src-tauri/src/database/services/connection.rs` `connect_to_database`
  (~L726, the `match` over `Database`): add a `Database::D1 { … }` arm that builds
  `D1Http`, does a cheap `SELECT 1` to validate, and stores the client. (Add the
  matching `Database::D1` variant wherever `Database` is defined.)

> ⚠️ This half is the real work. Budget for: wiring a new enum variant through
> every exhaustive `match` on `DatabaseClient`/`Database`/`DatabaseType` (the
> compiler will list them — fix each), and matching the exact row/column shape
> the `ExecSender` expects. Use `cargo check` iteratively.

## Half B — connect-flow (follow the pattern doc)

- `apps/desktop/src-tauri/src/integrations/cloudflare.rs`: `save_token`,
  `disconnect`, `is_connected`, `list_accounts`, `list_databases(account_id)`,
  `current_account` (account name from `/accounts`). Token verify via
  `/user/tokens/verify`.
- Commands `cloudflare_*` in `commands/integrations.rs`; register in `lib.rs` +
  `bindings.rs`. *(SHARED, append-only.)*
- `features/integrations/cloudflare/` — api wrapper, hook, `cloudflare-connect-flow.tsx`.
  The flow has **two pick steps** (account → database) because D1 is
  account-scoped; model it as account picker → database picker. `onComplete`
  returns `{ name: db.name, type: 'd1', url: \`d1://${accountId}/${db.uuid}\`,
  authToken: token, status: 'idle' }`.
- Surface in `database-type-selector.tsx` + `connection-dialog.tsx` +
  `source-labels.ts` (`case 'd1': return 'Cloudflare D1'`). *(SHARED.)*
- Icon in `provider.icons.tsx`.

## Acceptance criteria

- [ ] Paste a Cloudflare API token (scoped to D1 read/write) → account picker →
      database picker → "Connected as <account>".
- [ ] Creating the connection opens the studio and **lists D1 tables** (schema
      introspection over HTTP works).
- [ ] Running `SELECT`/`INSERT`/`UPDATE`/`DELETE` in the SQL console works and
      shows results / affected rows.
- [ ] Inline cell edit + add/delete row work (these go through `execute_query`).
- [ ] D1 API errors surface as readable messages (not raw JSON).
- [ ] `cargo test --lib` green; both `bindings.ts` synced; typechecks clean.

## Risks / unknowns

- **Batch/transaction semantics:** D1's `/query` runs statements without
  interactive transactions. Multi-statement scripts and the app's mutation flow
  (which may assume transactional execute) need checking — verify how
  `execute_query` is used for multi-row edits and whether D1's autocommit is
  acceptable. Document any limitation in the connect-flow.
- **Result-set shape for writes:** map `meta.changes` / `last_row_id` to whatever
  the `ExecSender` reports as "rows affected".
- **Rate limits / large results:** D1 caps response sizes; large `SELECT *` may
  need a `LIMIT`. The studio already paginates table data — confirm the
  page-size queries translate.
- **Token scopes:** surface a helpful message if the token lacks D1 edit scope
  (mirror the Supabase "lacks Database scope" message).

## Verification

`cd apps/desktop/src-tauri && cargo check && cargo test --lib`; regenerate
bindings; `bun run typecheck` in both; then **manual**: connect a real D1
database and exercise read + write. (No live D1 in CI — manual is required.)

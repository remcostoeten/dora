# The provider integration pattern (canonical recipe)

This is the reusable recipe for adding a **cloud provider connect-flow** that
ends in a standard connection. The Turso/Supabase/Neon integrations all follow
it. "Cheap" connectors (Vercel, PlanetScale, Xata) are ~pure copies of this with
a different API client; they reuse the existing Postgres/MySQL query adapter, so
**no new Rust query adapter is required**.

Read this once; each cheap-connector plan only specifies its deltas.

## Reference implementations (copy these)

- Backend: `apps/desktop/src-tauri/src/integrations/neon.rs` (token-paste, REST
  discovery, account lookup, pagination, `read_body` error context).
- Command wrappers: `apps/desktop/src-tauri/src/database/commands/integrations.rs`
  (`neon_*`, `turso_*`).
- API wrapper: `packages/studio/src/features/integrations/neon/neon-api.ts`.
- Hook: `packages/studio/src/features/integrations/neon/use-neon-databases.ts`.
- Connect-flow UI: `packages/studio/src/features/integrations/neon/neon-connect-flow.tsx`.

## What a connect-flow produces

The flow ends by calling `onComplete(connection)` where `connection` is
`Omit<Connection, "id" | "createdAt">`. The `Connection` type is in
`packages/studio/src/features/connections/types.ts`:

```ts
type DatabaseType = 'postgres' | 'cockroach' | 'mysql' | 'mariadb'
  | 'sqlite' | 'duckdb' | 'libsql'
// Connection: { name, type, host?, port?, user?, password?, database?, ssl?,
//   url?, authToken?, poolerMode?, fileSources?, status?, sshConfig?, ... }
```

Cheap connectors set `type` to an **existing** engine (`postgres` or `mysql`)
and hand back a `url` (connection string). No `DatabaseType`/`DEFAULT_PORTS`
edit needed. Only connectors that add a *new engine* (e.g. D1) touch that union.

## Backend recipe (`integrations/<provider>.rs`)

Mirror `neon.rs` exactly:

1. `const TOKEN_SETTING_KEY: &str = "integration.<provider>.access_token";`
   and `const API_BASE_URL`.
2. `store_token` / `load_token` / `require_token` using `crate::security::{encrypt,decrypt}`
   + `storage.set_setting`/`get_setting`/`delete_setting`. (Copy verbatim.)
3. `is_connected(storage) -> bool` and `disconnect(storage) -> Result<()>`.
4. `read_body(response) -> String` helper (copy from neon.rs) — preserves error
   context instead of `unwrap_or_default()`.
5. `save_token(storage, token)` — trim, reject empty, validate by hitting a
   cheap authed endpoint (list projects), then `store_token`.
6. Discovery fn(s) that list the user's connectable resources (projects/DBs),
   returning a `#[derive(Serialize, Deserialize, Type)]` `#[serde(rename_all =
   "camelCase")]` struct. Paginate if the provider's API paginates (see neon.rs
   `get_projects` cursor loop).
7. `current_account(storage)` — return who you're connected as (org/email).
   This is now standard across providers; do not skip it.
8. A "build connection" fn if the provider mints a credential/URI (see
   `neon::create_connection_uri`). For providers that just expose a static
   connection string, the connect-flow can assemble it client-side instead.

## Command wrappers (`commands/integrations.rs`) — SHARED, append-only

Add `#[tauri::command] #[specta::specta]` async wrappers that take
`state: State<'_, AppState>` and call `<provider>::*(&state.storage, …)`. Import
your new types at the top `use crate::{ integrations::<provider>::{self, …} }`.

## Registration — SHARED, append-only

- `apps/desktop/src-tauri/src/lib.rs`: add each command to the
  `tauri::generate_handler![…]` list.
- `apps/desktop/src-tauri/src/bindings.rs`: add each command to
  `collect_commands![…]`.

## Frontend recipe (`features/integrations/<provider>/`)

1. `<provider>-api.ts` — thin wrappers over `commands.*` that
   `assertTauriRuntime()` and unwrap `Result` (copy `neon-api.ts`).
2. `use-<provider>-databases.ts` — `{ data, isLoading, error, refresh, reset }`
   (copy `use-neon-databases.ts`).
3. `<provider>-connect-flow.tsx` — copy `neon-connect-flow.tsx`. It already
   includes the hardened UX you want: account label in header ("Connected as
   …"), Refresh button, empty-state message, clear-error-on-select, disconnect
   tooltip, `DesktopOnlyNotice` when not in Tauri. Swap the API calls + the
   `onComplete({...})` connection shape.

## UI surfacing — SHARED, append-only

- `connection-dialog/database-type-selector.tsx`:
  - add `'<provider>'` to the `ProviderKey` union,
  - add a `TYPE_THEME['<provider>']` `{ accent, wash }` entry,
  - add a `Tile` (key, name, description, icon) and include it in the grid.
- `connection-dialog.tsx`:
  - import `<Provider>ConnectFlow`,
  - add `'<provider>'` to the `selectedIntegration` union,
  - add the conditional `{<provider>Selected && <…ConnectFlow … />}`.
- `source-labels.ts`: add a `resolveProviderLabel` case returning the display
  name.

## Provider icon

Add an icon to `packages/studio/src/components/provider.icons.tsx` (this file is
already in the working set; follow the existing `SupabaseIcon` etc.).

## Acceptance criteria (every cheap connector)

- [ ] User picks the provider tile → connect-flow renders.
- [ ] Paste token → validated; bad token shows a clear error; good token lands
      on the resource picker.
- [ ] Header shows "Connected as <account>".
- [ ] Picking a resource → `onComplete` produces a connection that **actually
      connects and lists tables** (reuses the existing Postgres/MySQL adapter).
- [ ] Disconnect clears the stored token; reconnect works.
- [ ] `cargo test --lib integrations::<provider>` passes (add decode tests like
      neon.rs has).
- [ ] Both `bindings.ts` files updated; studio + desktop typecheck clean.

## Verification

See `../README.md` → Verification + Bindings regeneration.

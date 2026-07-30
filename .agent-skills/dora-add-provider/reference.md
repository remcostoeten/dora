# Add a provider — reference

The eight existing integrations, and what a new one has to touch. Paths and
identifiers are current.

## 1. What each existing provider actually does

| Provider | Auth | Levels modelled | Credential the connection gets | Engine |
| --- | --- | --- | --- | --- |
| Supabase | OAuth (loopback + hosted proxy) or pasted PAT | organizations, projects | user-supplied project database password, embedded in the URL; remembered per project under `integration.supabase.password.<ref>` | postgres |
| Neon | pasted API key | account, projects, branches, databases | pooled connection URI minted by `create_connection_uri` | postgres |
| Turso | pasted token, or minted through the Turso CLI | organizations, databases | database token from `create_token`, carried as `authToken` | libsql |
| PlanetScale | pasted service token | organizations, databases, branches | password minted by `create_password` (a real, named credential in the user's account) | mysql |
| Vercel | pasted token | account, stores | store's `POSTGRES_URL` when the API returns one, otherwise pasted by the user | postgres |
| Xata | pasted key | account, databases | the API key itself, embedded as the Postgres password by `build_connection_string`; branch pinned to `main` | postgres |
| Cloudflare | pasted API token | accounts, D1 databases | none — the connection stores only `d1://{account}/{database}` | d1 |
| PostHog | pasted personal API key | region, project | none — the connection stores only `posthog://{region}/{project}` | posthog |

The last two are the split that matters: their engines have no URL credential
slot, so the backend reads the token back out of the integration setting on every
connect (`cloudflare::connect_token`, `posthog::connect_token`). Disconnecting
breaks those connections and leaves the other six working.

Only Supabase has OAuth, a refresh path (`current_access_token`, `authed_get`,
`refresh_oauth`) and more than one settings key. Only Turso has a CLI escape
hatch (`cli_available`, `cli_login`, `mint_token_via_cli`, `install_cli`).

## 2. Backend checklist

| Path | What |
| --- | --- |
| `apps/desktop/src-tauri/src/integrations/<name>.rs` | The module. Constants first (`TOKEN_SETTING_KEY`, `API_BASE_URL`), then the `Serialize + Deserialize + specta::Type` structs the UI sees, then private `Deserialize`-only response structs, then `store_token` / `load_token` / `require_token`, then `read_body`, then the API functions, then `#[cfg(test)]` decode tests. |
| `apps/desktop/src-tauri/src/integrations/mod.rs` | `pub mod <name>;` |
| `apps/desktop/src-tauri/src/database/commands/integrations.rs` | One `#[tauri::command] #[specta::specta]` per public module function, named `<provider>_<verb>`, taking `State<'_, AppState>` and calling through `&state.storage`. |
| `apps/desktop/src-tauri/src/lib.rs` and `apps/desktop/src-tauri/src/bindings.rs` | Registration — two separate lists. `dora-tauri-boundary`. |

Required public surface, same names in every module:

```
is_connected(&Storage) -> bool
disconnect(&Storage) -> Result<()>
save_token(&Storage, String) -> Result<()>      // validates, then stores
current_account(&Storage) -> Result<<Provider>Account>
list_<resource>(&Storage, ...) -> Result<Vec<...>>
```

Plus exactly one of: a mint (`create_connection_uri`, `create_token`,
`create_password`, `build_connection_string`) when the engine takes a URL
credential, or `connect_token(&Storage) -> Result<String>` when the backend needs
the raw token at connect time.

Shared helpers to use rather than re-write: `crate::http::client()`
(`apps/desktop/src-tauri/src/http.rs`), `security::encrypt` / `security::decrypt`,
and `Storage`'s `set_setting` / `get_setting` / `delete_setting` /
`delete_settings_with_prefix`.

## 3. Frontend checklist

All under `packages/studio/src/`:

| Path | What |
| --- | --- |
| `features/integrations/<name>/<name>-api.ts` | One exported function per command. `assertTauriRuntime()`, `commands.*`, throw `result.error` on `result.status === 'error'`. Pure URL builders live here too (`buildSupabaseConnectionUrl`). |
| `features/integrations/<name>/use-<resource>.ts` | Optional fetch hook; most providers have one (`use-neon-databases.ts`, `use-planetscale-databases.ts`). |
| `features/integrations/<name>/<name>-connect-flow.tsx` | Exported component checks `useIsTauri()` and returns `MockProviderConnectFlow` or the inner component. `Props` is `{ onComplete: (connection: Omit<Connection, 'id' \| 'createdAt'>) => void }`. |
| `features/integrations/_shared/mock-provider-data.ts` | A `MockProviderConfig` with label, accent, blurb, `connectLabel`, `itemNoun`, three fake projects and a `buildConnection`. |
| `features/connections/components/connection-dialog/database-type-selector.tsx` | `ProviderKey` member, a `TYPE_THEME` entry (total record), a `<NAME>_TILE`, a `show<Name>` prop, and the `tiles.push` line. |
| `features/connections/components/connection-dialog.tsx` | The `selectedIntegration` union member, the `<name>Selected` const, the `show<Name>={!initialValues}` prop, and a branch in the flow chain that calls `onSave(connection)` then `onOpenChange(false)`. |
| `features/connections/utils/providers.ts` | A `PROVIDER_PATTERNS` row matching the hostname the flow emits, with `type` and `requiresSsl`. |
| `features/connections/source-kinds.ts` | A `DbPreset` member, if the provider should be recognisable as its own vendor. |
| `features/connections/resolve-source.ts` | `resolvePresetToEngine` case, and `inferSourceKind` if it should read as `cloud-preset`. |
| `features/connections/source-labels.ts` | `resolveProviderLabel` case for the preset. |

A provider that needs a `DatabaseType` of its own is not a provider — it is an
engine. `dora-add-database-driver`.

## 4. Docs

| Path | What |
| --- | --- |
| `README.md` | A row in the "Connect a provider account" table, phrased as what the user does ("Add a service token, pick a branch"). |
| `docs/connect/<provider>.mdx` and `docs/connect/meta.json` | A connect page, listed in the meta or it does not appear. Supabase, Neon, Turso, PlanetScale, Vercel and PostHog have pages; Xata and Cloudflare D1 do not. |
| `apps/marketing/src/components/providers-section.tsx` | A `{ name, src }` entry, with the logo at `apps/marketing/public/providers/<name>.svg`. |

## 5. Known gaps in the existing set

State these rather than assuming they are handled:

- No connection records which provider created it. There is no origin field, so
  nothing can refresh a rotated credential for an existing connection —
  reconnecting means going through the flow again.
- `sql.xata.sh` has no `PROVIDER_PATTERNS` row, so an Xata connection displays as
  a generic Postgres.
- `tools/scripts/verify-providers.ts` covers only some of the eight providers.
- PlanetScale's `create_password` mints a new named credential in the user's
  account on every connect and nothing ever deletes them.

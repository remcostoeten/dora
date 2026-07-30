# Connection lifecycle — reference

Detail behind `SKILL.md`. Paths and identifiers only, no line numbers.

## Where connection state lives

| State | Home |
| --- | --- |
| Saved connections | the `connections` table in the app SQLite DB, written by `apps/desktop/src-tauri/src/storage/connections.rs`; the config is one `connection_data` string, AES-256-GCM encrypted by `security::encrypt` |
| Which variant a row is | the `database_type_id` column, mapped by the `DB_TYPE_*` constants in `apps/desktop/src-tauri/src/storage/serialize.rs` |
| Runtime connections | `AppState.connections: DashMap<Uuid, DatabaseConnection>` in `apps/desktop/src-tauri/src/lib.rs` |
| Driver handles | the per-variant field on `Database` in `apps/desktop/src-tauri/src/database/types.rs` |
| Health handles | `ConnectionMonitor.connections`, a `HashMap` of connection id to `ConnectionCheck` |
| Schema cache | `AppState.schemas`, evicted by DDL and mutations, never by teardown |
| Frontend connection list | the `connections` react-query key; `backendToFrontendConnection` in `packages/studio/src/features/connections/utils/mapping.ts` maps `connected` onto `status` |
| Session (which connections were open) | `localStorage` under `dora-session`, `packages/studio/src/core/tabs/session-persistence.ts` |

Decryption is lazy-migration tolerant: `get_connection` and `get_connections`
try `security::decrypt` and fall back to treating the stored string as
plaintext, so a pre-encryption row still reads.

## Connect sequence per engine

All of these live in `ConnectionService::connect_to_database` in
`apps/desktop/src-tauri/src/database/services/connection.rs`. Every arm ends by
setting `connected` and, on success, calling `storage.update_last_connected`.

**Postgres and CockroachDB** — start the SSH tunnel if `ssh_config` is set;
`clean_postgres_connection_string` splits the string into a parseable form plus
`disable_channel_binding` and `verify_tls` flags; parse into
`tokio_postgres::Config`; fill the password from the keyring only when the config
has none; rewrite host/port to loopback when tunnelled; `postgres::connect::connect`
with the certificate store; probe `SELECT version()` and overwrite `dialect`;
store the client; register the returned `ConnectionCheck` with the monitor. On
failure the tunnel is cleared and `connected: false` is returned.

**MySQL and MariaDB** — parse the URL; fill the password from the keyring when
the URL has none; start the tunnel and rewrite host/port; build a pool with
`PoolConstraints` of `MYSQL_POOL_MIN` (0) to `MYSQL_POOL_MAX` (4); `get_conn`
under `crate::http::CONNECT_TIMEOUT`; `ping`; probe `SELECT VERSION()` and
overwrite `dialect`. Both the error and the timeout branch call
`spawn_mysql_pool_disconnect` on the pool they just built.

**SQLite** — `rusqlite::Connection::open(&db_path)` behind an `Arc<Mutex<..>>`.
No tunnel, no probe.

**DuckDB (both modes)** — `build_duckdb_backend` in
`apps/desktop/src-tauri/src/database/duckdb_backend.rs`, which always goes
through the helper process client in
`apps/desktop/src-tauri/src/database/duckdb_ipc/client.rs`. With sources, each
registration outcome is logged and the connection is refused only when
`file_source::has_active_sources` is false. `file_source_entries` is overwritten
on every attempt, including the refused one.

**libSQL** — remote when the URL starts with `libsql://` or `https://`, built
with the `auth_token` from the connection; otherwise a local builder with
`skip_safety_assert(true)`, which is required because `Storage` already
initialized SQLite through rusqlite.

**Cloudflare D1 and PostHog** — no wire protocol. Load the token from the
encrypted integration setting, build the HTTP handle from the `d1://` or
`posthog://` URL, then probe with a trivial query so a bad or expired token fails
at connect rather than at first use.

## Credential storage matrix

| Secret | Stored where | Read when |
| --- | --- | --- |
| Postgres, CockroachDB, MySQL, MariaDB password | OS keyring, service `"Dora"`, account = connection uuid, via `apps/desktop/src-tauri/src/credentials.rs` | connect and test, only when the parsed config has no password |
| The same password when the keyring is unavailable or the write failed | inline in the connection string inside the encrypted `connection_data` blob | with the connection row |
| libSQL `auth_token` | the encrypted `connection_data` blob — `extract_sensitive_data` passes libSQL through untouched | with the connection row |
| `SshConfig.password` and `private_key_path` | the encrypted `connection_data` blob | connect and test, when starting the tunnel |
| Cloudflare token, PostHog personal API key | an encrypted row in the `settings` table, key `integration.cloudflare.access_token` and its PostHog counterpart | every connect, through `connect_token` |
| The AES key itself | OS keyring under service `dora_db_client`, account `dora_encryption_key`; otherwise a hex key file named by `FALLBACK_KEY_FILE` in the OS config dir under `dora`, created with mode 0600 on unix | on every encrypt and decrypt |

`credential_storage::backend()` is decided once per process by probing the
keyring, cached in a `OnceLock`, and logged once by `warm_up()`. When it is
`LocalEncryptedFile`, `credentials::get_password` returns `Ok(None)` and
`store_password` returns an error — that is the trigger for the inline fallback.
`packages/studio/src/components/credential-storage-notice.tsx` is the only
consumer of the status in the studio.

## Health and drop detection

`ConnectionCheck` is `tauri::async_runtime::JoinHandle<()>` wrapping the
tokio-postgres connection driver future (`apps/desktop/src-tauri/src/database/postgres/connect.rs`).

- `ConnectionMonitor::new` spawns the poll loop once, at Tauri setup.
- The loop calls `take_finished`, which removes and returns every id whose handle
  reports `is_finished()`, then sleeps 5 seconds.
- `upsert` aborts a replaced handle so a stale check cannot evict a freshly
  reconnected connection. Both behaviours have tests in
  `apps/desktop/src-tauri/src/database/connection_monitor.rs`.
- `notify_disconnect` calls `persist_disconnect` and then emits
  `end-of-connection` to `EventTarget::App` with the connection id.
- `persist_disconnect` has an arm per `Database` variant; it clears the handle
  and, for MySQL, closes the pool. It does not touch `tunnel`.

## Data-file sessions

`apps/desktop/src-tauri/src/database/duckdb/file_source.rs` holds the whole
contract: `DataFileSourceStatus` is `Active`, `Missing` or `Failed`;
`DataFileSourceEntry` carries the path, generated view name, file type, status
and error; `register_sources` creates one `CREATE OR REPLACE VIEW` per file over
`read_csv_auto`, `read_parquet` or `read_json_auto`, chosen by extension in
`reader_expr`. A path that does not exist is `Missing` before DuckDB is asked;
an unsupported extension is `Failed`.

Studio side:

- `resolveDataFileHealth` in
  `packages/studio/src/features/connections/data-file-health.ts` collapses the
  entries into `active`, `connected-with-issues` or `unavailable`.
- `packages/studio/src/features/database-studio/hooks/use-data-file-sources.ts`
  owns recovery: `retryRegistration` (in place), `relocateSource` and
  `removeSource` (both through `persistSources`, which updates the connection,
  disconnects, reconnects, then invalidates the `schema` and `connections` keys).
- `packages/studio/src/features/connections/local-file-errors.ts` is the copy for
  the save and import flows; map a backend message through it rather than
  surfacing raw text.
- `packages/studio/src/features/database-studio/hooks/use-save-data-file-session.ts`
  turns a materialized session into a new saved connection and connects it.

Backend guards, all in `ConnectionService`:
`import_files_into_duckdb` requires a connected DuckDB connection with empty
`file_sources`; `save_data_file_session_as_duckdb` requires non-empty sources, an
open handle and at least one active entry, and validates the destination through
`save_session::validate_destination_path`; `retry_data_file_registration` falls
back to a full `connect_to_database` when the handle is gone.

Each of those three drops the `DashMap` reference before awaiting the helper,
because the helper call is out-of-process. Keep that shape: take a clone of the
handle plus a snapshot, drop the guard, then await.

## Teardown call sites

| Site | Also does |
| --- | --- |
| `disconnect_from_database` command in `apps/desktop/src-tauri/src/database/commands/connections.rs` | stops live monitors for the connection first |
| `ConnectionService::disconnect_from_database` | `monitor.remove_connection`, then clears the handle and the tunnel per variant |
| `ConnectionService::update_connection`, config-changed branch | clears handle and tunnel, sets `connected = false`, rebuilds the `Database` value; does not deregister from the monitor |
| `ConnectionService::remove_connection` | `monitor.remove_connection`, `credentials::delete_password`, `storage.remove_connection`, then drops the map entry and closes a MySQL pool; does not stop live monitors |
| `ConnectionMonitor::persist_disconnect` | clears the handle only |

`SshTunnel::drop` sets `stop_signal` and takes the thread handle without joining.
The accept loop checks the flag once per 200 ms timeout, then disconnects the
russh session. Already-forwarded sockets are not closed by the flag; they end
when either side closes.

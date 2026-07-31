---
name: dora-connection-lifecycle
description: Connection lifecycle from a saved config to a torn-down handle. Use when changing how a connection is created, persisted, opened, tested or closed; where a password, token or SSH key is stored, read or deleted; how a connection's health is watched and what a drop does to open state; what happens on relaunch or when a local database or data file has moved; or how a data-file session differs from a database connection. Not for running queries (dora-query-pipeline) and not for the IPC command surface (dora-tauri-boundary).
---

# Connection lifecycle

## Scope

This skill owns creating, persisting, opening, watching, credentialling,
tunnelling and tearing down a connection.

Executing SQL over an open connection, cancelling it and paging its rows is
`dora-query-pipeline`'s. Command signatures, payload types and error shape are
`dora-tauri-boundary`'s. Nothing here restates either.

## Unencodable

Source has two or more answers and `.agent-skills/FINDINGS.md` declines to pick
one. Ask before deciding.

- Which capability table gates a connection feature: the Rust `SourceCaps` or
  the frontend `ENGINE_CAPS` (FINDINGS 4.4).
- Which engine enum a new connection category belongs in; four overlapping ones
  exist (FINDINGS 4.5).
- Whether a new connection command must also be added to the hand-written
  `get_command_contract()` (FINDINGS 4.18).
- Whether SSH credentials should move to the keyring. The `Database::Postgres`
  arm of `connect_to_database` carries an unresolved comment block asking
  exactly this and answers it with "for now". Do not silently decide it.

## Workflow

1. Decide which `Database` variant in
   `apps/desktop/src-tauri/src/database/types.rs` owns the resource. Every
   connection resource is a field on exactly one variant; there is no side
   table.
2. Put the open logic in the matching arm of `ConnectionService` in
   `apps/desktop/src-tauri/src/database/services/connection.rs`. The commands in
   `apps/desktop/src-tauri/src/database/commands/connections.rs` are
   pass-throughs and should stay ones.
3. If the change adds a field that holds a handle, thread it through all three
   teardown sites in the same commit (listed under Invariants). A field added to
   one is a leak in the other two.
4. Credential handling goes through `apps/desktop/src-tauri/src/credentials.rs`,
   never through a new keyring call site.
5. Frontend state follows the connection list: `backendToFrontendConnection` in
   `packages/studio/src/features/connections/utils/mapping.ts` derives `status`
   from `connected`, so anything that changes connectedness must end with an
   invalidation of the `connections` query key.

## Invariants

**One `Database` variant owns every resource, and teardown is assigning
`None`.** There are exactly three teardown sites, and a handle field must be
cleared in all three: `disconnect_from_database` and the `config_changed` branch
of `update_connection` (both in
`apps/desktop/src-tauri/src/database/services/connection.rs`), and
`ConnectionMonitor::persist_disconnect` in
`apps/desktop/src-tauri/src/database/connection_monitor.rs`. Anything needing an
async close needs a fourth arm in `remove_connection`.

**A tunnel is owned by the connection's `tunnel` field and by nothing else.**
Only `Database::Postgres` and `Database::MySQL` have one. Dropping the last
`Arc<SshTunnel>` is the teardown: `SshTunnel::drop` sets `stop_signal` and the
accept loop exits at its next 200 ms timeout. So the tunnel dies exactly when
the field is set to `None` — on connect failure, on disconnect, and on a changed
config — and never dies if you clone the `Arc` somewhere that outlives the
field. `test_connection` owns a local temp tunnel instead and must drop it on
both the success and the failure path.

**A tunnel is started before the driver connects and rewrites the target to
`127.0.0.1:local_port`.** Postgres does this by mutating the parsed
`tokio_postgres::Config`, MySQL by mutating the parsed `url::Url` before the
pool is built. A new tunnelled engine does the same rewrite in its own arm;
there is no shared helper and inventing one is not this skill's call.

**The keyring holds a URL password and only when the OS backend is live.**
`credentials::extract_sensitive_data` strips the password out of the connection
string, and `store_sensitive_data` writes it under service `"Dora"` keyed by the
connection id. If `credential_storage::backend()` is `LocalEncryptedFile`, or
the write fails, `add_connection` and `update_connection` restore the original
`DatabaseInfo`, so the password stays inline in the connection string. Both
paths are then encrypted at rest by `security::encrypt` on the `connections`
row, so never treat "the keyring has it" as guaranteed.

**Everything secret that is not a URL password rides in the encrypted
connection blob.** `SshConfig.password`, `SshConfig.private_key_path` and the
libSQL `auth_token` are not extracted by `extract_sensitive_data` and are
persisted whole. The exceptions are D1 and PostHog, whose tokens are never on
the connection at all: `connect_to_database` loads them per connect through
`integrations::cloudflare::connect_token` and
`integrations::posthog::connect_token`.

**A credential is decrypted at connect time, and only when the config lacks
one.** Postgres reads the keyring when `config.get_password().is_none()`; MySQL
when `mysql_url.password().is_none()`. The whole connection blob is separately
decrypted on every `Storage::get_connection` / `get_connections`. Do not add a
call site that reads a credential eagerly or on a list refresh.

**Password removal is explicit.** There is no zeroization; plaintext still
lives in the active driver config for the process lifetime. Removing a saved
password requires `clear_password` on `update_connection`, which deletes the
keyring entry when no replacement password is supplied. Removal also deletes
it. `verify_pin_and_get_credentials` is the one sanctioned plaintext-password
IPC path and refuses connections without a persisted PIN.

**SSH host keys are verified before authentication.** A configured
`host_key_fingerprint` pins the SHA-256 fingerprint. Without a pin, the tunnel
uses strict OpenSSH `~/.ssh/known_hosts`; unknown or mismatched keys fail rather
than being accepted on first use.

**Health is a dead-handle poll, not a probe.** `connect` returns a
`ConnectionCheck`, which is the `JoinHandle` of the tokio-postgres connection
driver future; `ConnectionMonitor` polls `is_finished()` on every registered
handle every 5 seconds. The handle finishing *is* the failed check. Nothing
pings, and only the Postgres arm calls `monitor.add_connection`, so
Postgres and CockroachDB are the only monitored engines.

**A failed check closes the connection server-side-first, in memory.**
`persist_disconnect` sets `connected = false` and clears the variant's client or
pool, then `end-of-connection` is emitted with the connection id. Replacing a
live client means re-registering with `monitor.add_connection`; deliberately
dropping one means calling `monitor.remove_connection` first, or your own
teardown is reported as a server-side drop.

**Relaunch starts with an empty map and hydrates lazily.**
`AppState.connections` is empty at boot — nothing calls `initialize_connections`
— and `connect_to_database` loads the row from `Storage` on a miss before
opening anything. So after relaunch every connection is `connected: false`,
`detected_dialect: None`, `pin_hash: None`, and back to the vanilla dialect
until `version()` detection runs again. Never assume an id is present in the
map; go through `connect_to_database`.

**Connect is idempotent and reports failure in its payload, not as an error.**
An already-connected id returns early with `connected: true`; a failure returns
`Ok(DatabaseConnectResult { connected: false })`. A resolved
`commands.connectToDatabase` is not success — read `connected`.

**A moved or missing local database file is not an error.**
`rusqlite::Connection::open` and `duckdb::Connection::open` create the file, so a
SQLite or DuckDB connection whose path has moved opens successfully against a
new, empty database. Only data-file sources report: `register_sources` marks a
vanished path `Missing`, and the connection still opens as long as one entry is
`Active`. Any new "is this file still there?" check is explicit and belongs
beside `probe_database_file_header` in
`apps/desktop/src-tauri/src/window/file_probe.rs`.

**Recovering a moved data file re-persists and reconnects; it never patches
entries.** `relocateSource` and `removeSource` in
`packages/studio/src/features/database-studio/hooks/use-data-file-sources.ts`
rewrite `file_sources`, save the connection, disconnect, reconnect and re-cache
whatever the connect result returned. `retryDataFileRegistration` is the only
in-place path and it re-registers every source through the existing handle.

**A non-empty `file_sources` is what makes a session a data-file session.**
That single field is the discriminator on both sides. Non-empty means DuckDB
opens in memory with one read-only view per file and hands out
`DatabaseClient::DuckDB { read_only: true }`; empty means `db_path` is opened
directly and is writable. The frontend asks
`describeConnectionSource(connection).kind === 'data-file'`
(`packages/studio/src/features/connections/resolve-source.ts`). Do not add a
second flag, and gate new behaviour the same way the existing commands do:
`import_files_into_duckdb` requires empty, `retry_data_file_registration` and
`save_data_file_session_as_duckdb` require non-empty.

**MySQL is the only handle with a real close.** `Pool::disconnect()` via
`spawn_mysql_pool_disconnect` is the deterministic teardown; plain drop closes
server sessions best-effort only. Any new pooled driver needs the same treatment
at all four sites.

**One DuckDB helper child serves every DuckDB connection.** The process-wide
`MANAGER` in `apps/desktop/src-tauri/src/database/duckdb_ipc/client.rs` spawns
it lazily and respawns it only when it has died. Disconnecting drops an
`IpcDuckDbConn`, which best-effort sends `Close` for its own `conn_id` and
nothing more. Never assume the helper stops when a connection does, and never
add per-connection helper spawning.

**Process exit tears nothing down.** The `RunEvent::Exit` handler in
`apps/desktop/src-tauri/src/lib.rs` stops the managed Ollama server and nothing
else — no pool disconnect, no tunnel stop, no helper shutdown. Anything that
must be closed cleanly is closed when its field is cleared, not at shutdown.

### Ownership and teardown by category

Every category owns its resources on the connection entry itself, and teardown is
clearing that field. Read this as the rule for what a change must release.

| Category | Owns while open | Teardown |
| --- | --- | --- |
| Normal server — Postgres, CockroachDB, MySQL, MariaDB, remote libSQL | the `client`, `pool` or `connection` `Arc`; for Postgres also the `ConnectionCheck` held by `ConnectionMonitor` | clear the field; `monitor.remove_connection` first; `spawn_mysql_pool_disconnect` for a pool |
| Local file — SQLite, native DuckDB, `file:` libSQL | an open handle on the user's file; for DuckDB an `IpcDuckDbConn` in the shared helper | clear the field, which closes the handle and sends the helper a `Close`; never touch the file itself |
| Data file — DuckDB with non-empty `file_sources` | an in-memory helper connection, one read-only view per source, and `file_source_entries` | clear the connection field; the entries stay as last-known status and are recomputed by the next connect or retry |
| HTTP-backed — D1, PostHog | an `Arc` over the HTTP handle holding the decrypted token in memory; no socket | clear the field, which is the only thing that drops that token copy; the stored setting is untouched |
| Provider-created — every connect flow under `packages/studio/src/features/integrations` | nothing beyond the category its `DatabaseInfo` variant lands in | the underlying category's teardown; removal never revokes a provider token or deletes a remote database |
| Tunnelled — Postgres or MySQL with an `ssh_config` | additionally the `SshTunnel`: a bound loopback listener, an OS thread, a current-thread runtime and the russh session | clear the `tunnel` field; nothing else stops it |

## Known gaps

State these as gaps; do not write around them as if they were solved.

- Health monitoring covers Postgres and CockroachDB only. Every other engine can
  be dead in the map with `connected: true` until its next query fails.
- `initialize_connections` is registered as a command and has no caller.

## Common mistakes

- Adding a handle field and clearing it in `disconnect_from_database` only,
  leaving the monitor and the config-changed paths leaking.
- Holding an `Arc<SshTunnel>` outside the `tunnel` field, so setting the field to
  `None` no longer stops the thread.
- Treating a resolved `connectToDatabase` as connected instead of reading
  `connected`.
- Assuming a saved connection is in `AppState.connections` after relaunch, or
  calling `initialize_connections` to make it so.
- Assuming a keyring password exists; the local-encrypted-file backend never
  stores one, and `get_password` returns `Ok(None)` there.
- Adding a new keyring or decrypt call site instead of going through
  `credentials.rs`.
- Reporting "connected" for a moved SQLite or DuckDB path without noticing the
  driver just created an empty database at that path.
- Branching on anything other than `file_sources` emptiness to tell a data-file
  session from a database connection.
- Swapping a live client without `monitor.add_connection`, or dropping one
  without `monitor.remove_connection` first.
- Dropping a MySQL pool instead of calling `spawn_mysql_pool_disconnect`.
- Relying on app shutdown to close pools, tunnels or the DuckDB helper.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
```

`connection_monitor.rs` carries the tests that pin the monitor contract: a fresh
handle survives replacing a stale one, and finished handles are reported once
and removed. `credentials.rs` pins password extraction, including percent
decoding and the empty-password case.

From the repository root:

```bash
bun run test:desktop
bun run --cwd packages/studio typecheck
bun run lint
```

## Definition of done

- Every new handle field is cleared in `disconnect_from_database`,
  `persist_disconnect` and the `config_changed` branch of `update_connection`,
  plus `remove_connection` when it needs an async close.
- A tunnel is reachable only through its `tunnel` field, and a temporary tunnel
  is dropped on both the success and the failure path.
- Credentials move through `credentials.rs`; no new keyring or decrypt call
  site, and no new command returns a plaintext credential.
- A new engine either registers with `ConnectionMonitor` or its lack of health
  monitoring is stated explicitly.
- Connect stays idempotent and still reports failure as `connected: false`.
- Data-file behaviour is gated on `file_sources` emptiness on both sides.
- Data-file recovery re-persists and reconnects rather than mutating
  `file_source_entries`.
- `cargo test` and `bun run test:desktop` pass.

See `reference.md` for the per-category resource and teardown table, the exact
connect sequence per engine, and the credential storage backend matrix.

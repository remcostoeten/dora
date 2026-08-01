# Spec 09: Redis / Valkey Browser

Status: `[!]` needs product decision before implementation. See "Open decision" below.

## Why

Nearly every developer runs Redis or Valkey locally; RedisInsight is a heavy Electron app and Medis is macOS-only. A fast native key browser strengthens the "10 MB binary" pitch. But Redis is not relational: it cannot ride the existing table-centric pipeline, so it needs an honest scoping decision first.

## Open decision

Redis support means a parallel UI mode, not a new provider branch. Confirm before starting:

1. Accept a dedicated "key-value studio" surface (sidebar lists keys, not tables; no SQL console, no schema visualizer, no Drizzle runner for these connections), or
2. Defer Redis entirely.

If (1) is accepted, flip status to `[ ]` and proceed with the scope below.

## Scope (v1, deliberately small)

- Connect: host/port/password/TLS, plus `redis://` / `rediss://` URL paste; Valkey is wire-compatible, so one implementation covers both names in the picker.
- Key browser: SCAN-based incremental listing (never `KEYS *`), pattern filter, namespace tree grouping on `:` separators, type + TTL badges.
- Value inspector per type: string (raw/JSON-pretty), hash, list, set, zset. Read and edit values, set/clear TTL, delete keys (with confirm).
- A simple command bar for raw commands with response rendering (RESP → readable), command history reusing the query-history pattern.
- Docker manager: add Redis/Valkey images to the existing container templates in `packages/studio/src/features/docker-manager/`.

Out of scope v1: pub/sub viewer, streams UI, cluster mode, memory analysis, Lua editor, monitoring dashboards.

## Safe write scope

- Backend: new `apps/desktop/src-tauri/src/kv/` module (deliberately **outside** `database/`; do not force Redis through `DatabaseType`/the adapter); new command file(s) + registration in `lib.rs`
- Connection storage: a parallel KV-connection record in `storage/` (additive, backward-compatible)
- Frontend: new `packages/studio/src/features/kv-studio/` feature; connection picker entry in `packages/studio/src/features/connections/`; routing in the studio shell so KV connections open the KV surface
- `apps/desktop/src-tauri/Cargo.toml` (`redis` crate, tokio + TLS features)

## Implementation notes

1. Keep the type system honest: a `KvConnectionInfo` separate from `DatabaseInfo` avoids polluting every provider `match` in the SQL pipeline. Shared bits (credential encryption, SSH tunneling via `database/ssh_tunnel.rs`) should be reused by reference, not duplicated.
2. SCAN cursor paging end-to-end: the UI requests pages; never materialize a full keyspace. Test against a 1M-key instance.
3. Editing safety: big values (multi-MB strings, 100k-member sets) must load truncated with explicit "load more"; deletes and TTL changes go through a confirm step consistent with the SQL dry-run philosophy.
4. The raw command bar must blocklist nothing but warn on destructive commands (`FLUSHALL`, `FLUSHDB`) with a typed-confirmation gate.

## Done when

- Connect to Docker Redis and Valkey; browse 1M seeded keys smoothly; inspect/edit all five core types; TTL and delete flows work with confirmation; raw `FLUSHDB` requires typed confirm.
- No regression or type-system leakage into SQL provider code paths (`database/` diff should be ~zero outside shared utils).
- Tests cover SCAN paging, value rendering per type, and the destructive-command gate.

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
# manual: docker run redis + valkey, seed with redis-benchmark, browse/edit
```

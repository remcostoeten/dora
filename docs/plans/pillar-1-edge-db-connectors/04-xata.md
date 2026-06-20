# Plan: Xata connector

**Tier:** cheap. **Effort:** S. **Depends on:** `00-provider-integration-pattern.md`.
**Reuses the existing Postgres adapter — no new Rust query adapter.**

Xata now exposes a **Postgres-compatible** endpoint per database/branch. A
connection is a standard Postgres connection string. `type: 'postgres'`, hand
back `url`.

## API facts (verify at build time — Xata's API has changed across versions)

- Auth: a Xata **API key** (`Authorization: Bearer`).
- Identity / "Connected as": `GET https://api.xata.io/user` → `{ email,
  fullname }`. Workspaces: `GET /workspaces`.
- Databases: per workspace, `GET https://api.xata.io/workspaces/{id}/dbs`.
- Postgres endpoint / connection string: confirm how Xata exposes the PG
  connection string for a branch (region-scoped host like
  `{region}.sql.xata.sh`, db name `{db}:{branch}`, the API key doubles as the
  password). **Resolve the exact connection-string assembly before coding the
  flow** — this is the one fiddly bit.

## Deltas vs the pattern

- `integrations/xata.rs`: `save_token`, `disconnect`, `is_connected`,
  `current_account` (email/fullname), `list_databases` (across workspaces).
- `features/integrations/xata/xata-connect-flow.tsx`: copy neon flow; pick
  database (and branch if applicable) → assemble the PG connection string →
  `onComplete({ name, type: 'postgres', url, status: 'idle' })`.
- SHARED registration + tile + label (`case 'xata': return 'Xata'`).

## Acceptance criteria

- [ ] API key → "Connected as <email>" → database list.
- [ ] Selecting a database produces a working Postgres connection (lists tables).
- [ ] Disconnect/reconnect; bad key clear error.
- [ ] Typechecks + `cargo test --lib integrations::xata`.

## Risks

- Connection-string assembly (region host + `db:branch` + key-as-password) is
  the only real unknown — pin it against a live Xata DB before finishing.
- Xata API shape drifts between versions; encode the version in `API_BASE_URL`
  and add decode tests with a sample payload.

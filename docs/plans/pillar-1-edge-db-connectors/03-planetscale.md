# Plan: PlanetScale connector

**Tier:** cheap. **Effort:** S–M. **Depends on:** `00-provider-integration-pattern.md`.
**Reuses the existing MySQL adapter — no new Rust query adapter.**

> Note: PlanetScale was built once and removed (too much connect friction); the
> API shapes are parked in project memory (`provider-integration-pattern`
> memory). The friction was credential creation. This plan minimizes it by
> minting a password via the API where possible and being branch-aware.

PlanetScale speaks the MySQL wire protocol. A connection is a standard MySQL
connection string (host/user/password/db, TLS required). `type: 'mysql'`, hand
back the host/user/password/database fields (or a `url`).

## API facts (verify at build time)

- Auth: a **service token** (`Authorization: <token-id>:<token>`) or OAuth.
  Service token is simplest; document the required scopes
  (`read_databases`, `connect_production_branches`, `create_password`).
- Identity / "Connected as": the organization. `GET /v1/organizations` →
  `{ data: [ { name } ] }`.
- Databases: `GET /v1/organizations/{org}/databases`.
- Branches: `GET /v1/organizations/{org}/databases/{db}/branches` (this is the
  branch-aware hook — see `05-branch-aware-connects.md`).
- **Credential minting (the friction-killer):**
  `POST /v1/organizations/{org}/databases/{db}/branches/{branch}/passwords`
  returns `{ username, access_host_url (host), password }` — a fresh connection
  credential, so the user never copies a secret. This is the equivalent of
  Neon's `create_connection_uri`.

## Deltas vs the pattern

- `integrations/planetscale.rs`: `save_token`, `disconnect`, `is_connected`,
  `current_account` (org name), `list_databases(org)`, `list_branches(org, db)`,
  and `create_password(org, db, branch)` → returns host/user/password to build a
  MySQL connection. Store org in settings or pass through.
- `features/integrations/planetscale/planetscale-connect-flow.tsx`: copy neon
  flow; pick database → branch (default to primary) → mint password →
  `onComplete({ name: \`${db}/${branch}\`, type: 'mysql', host, port: 3306,
  user, password, database: db, ssl: true, status: 'idle' })`.
- SHARED registration + tile + label (`case 'planetscale': return 'PlanetScale'`).

## Acceptance criteria

- [ ] Service token → org shown as "Connected as" → database → branch picker.
- [ ] Selecting a branch mints a password and produces a **working MySQL
      connection** (lists tables) with TLS.
- [ ] Disconnect/reconnect; bad token clear error.
- [ ] Branch-aware (default branch preselected; user can pick another).
- [ ] Typechecks + `cargo test --lib integrations::planetscale`.

## Risks

- PlanetScale requires TLS — ensure the MySQL adapter path sets `ssl: true`
  end-to-end (check how the existing MySQL connect consumes `ssl`).
- Minted passwords accumulate server-side; name them `dora-<timestamp>` (mirror
  Turso's token naming) and document that the user can prune them in the PS
  dashboard.
- If service-token scopes are missing, surface a scope-specific error.

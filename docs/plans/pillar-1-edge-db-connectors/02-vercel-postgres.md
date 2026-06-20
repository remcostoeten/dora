# Plan: Vercel Postgres connector

**Tier:** cheap. **Effort:** S. **Depends on:** `00-provider-integration-pattern.md`.
**Reuses the existing Postgres adapter — no new Rust query adapter.**

Vercel Postgres is Neon-backed Postgres exposed through Vercel. A connection is a
standard Postgres connection string, so the entire job is the connect-flow +
registration. `type: 'postgres'`, hand back `url`. No `DatabaseType` edit.

## API facts (verify against current Vercel API at build time)

- Auth: a Vercel **access token** (`Authorization: Bearer`). Optional team scope
  via `?teamId=`.
- Identity / "Connected as": `GET https://api.vercel.com/v2/user` → `{ user: {
  username, email } }`. Teams: `GET /v2/teams`.
- Stores (databases): Vercel exposes Postgres via the **Storage** API,
  `GET /v1/storage/stores?type=postgres` (shape changes — confirm). Each store
  yields connection-string env vars (`POSTGRES_URL` / `DATABASE_URL`).
- ⚠️ **Unknown to resolve first:** whether the access token can read a store's
  connection string directly, or whether the user must paste the `POSTGRES_URL`.
  If the API won't return the secret, fall back to: token validates identity +
  lists stores for *labeling*, but the user pastes the `POSTGRES_URL` for the
  chosen store. Document whichever path the API actually supports. (This mirrors
  Supabase's "password never returned by API" constraint.)

## Deltas vs the pattern

- `integrations/vercel.rs`: `save_token`, `disconnect`, `is_connected`,
  `current_account` (`/v2/user` → username/email), `list_stores` (label + id +,
  if available, connection string).
- `features/integrations/vercel/vercel-connect-flow.tsx`: copy neon flow; if the
  connection string isn't API-readable, add a password-style input for
  `POSTGRES_URL` on the selected store (reuse the Supabase password-field
  pattern). `onComplete({ name, type: 'postgres', url, status: 'idle' })`.
- SHARED registration + tile + label (`case 'vercel': return 'Vercel Postgres'`).

## Acceptance criteria

- [ ] Token → "Connected as <username/email>" → store list.
- [ ] Selecting a store yields a working Postgres connection (lists tables).
- [ ] Disconnect/reconnect works; bad token shows a clear error.
- [ ] Typechecks + `cargo test --lib integrations::vercel` (decode tests).

## Risks

- The Storage API shape is the main unknown — **resolve the "can we read the
  connection string?" question before writing the flow.** If no, the UX is
  token (for labeling/identity) + paste `POSTGRES_URL`; still better than raw
  manual entry because identity + store names are shown.

# Plan (epic stub): Upstash (Redis) connector

**Tier:** epic. **Effort:** L (new paradigm). **Depends on:** nothing, but is a
much larger effort than the cheap connectors — scope it as its own project.

> Correction to earlier framing: **Upstash does not offer Postgres.** Its
> products are Redis, Vector, and QStash. So this is **not** a cheap connect-flow
> over the existing relational adapter — it's a **new key-value paradigm** that
> the whole studio (data grid, SQL console, schema view) currently assumes away.
> Treat this as an epic, not a quick win. Listed here for completeness; **defer
> behind the cheap connectors and D1.**

## Why it's big

- New `DatabaseClient::Redis` variant + a Redis adapter (Upstash exposes a REST
  API over HTTPS: `POST https://<endpoint>/` with `Authorization: Bearer
  <token>`, body = a Redis command array; or use the `redis` crate over TLS).
- The studio's core surfaces are relational. Redis needs **new UI**: a key
  browser (scan/match), type-aware value viewers (string/hash/list/set/zset/
  stream), TTL display, not a table grid. That's a new feature module, not a
  connect-flow.
- Schema introspection, SQL console, ER diagram, ORM runners — none apply.

## If/when pursued — phasing

1. Decide scope: **read-only key browser** first (lower risk, still useful).
2. Backend: `integrations/upstash.rs` (token → list databases via Upstash API,
   `current_account`) + a `database/redis/` adapter (REST or `redis` crate).
3. New `DatabaseType::Redis` + connection model carrying the REST endpoint/token.
4. New frontend feature `features/redis-browser/`: key scan with cursor
   pagination, per-type value rendering, TTL, basic set/del.
5. Gate the studio's relational-only panels off for Redis connections (the UI
   currently assumes tables — audit every `type`-conditional surface).

## Recommendation

Ship the cheap connectors + D1 first to prove the market-share thesis; only
invest in Upstash/Redis if telemetry shows demand. Keep this doc as the scoping
note so it isn't mistaken for a quick win.

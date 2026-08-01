# Spec 07: Serverless Postgres Integrations (Neon, Supabase)

Status: `[x]` shipped, and extended well beyond the v1 scope below.

> **Shipped (2026-06-20).** Account-based connect flows ("Connect a provider account": add a token/OAuth → list resources → one-click connect) now ship for **Supabase** (OAuth), **Neon** (API key, branch-aware, #142/#156), **Turso** (token or CLI-minted), **PlanetScale** (service token, branch-aware, explicitly out-of-scope in v1, #141/#149), **Vercel Postgres** (#147), **Xata** (#140/#148), and **Cloudflare D1** (#139/#150, a genuinely new HTTP query engine rather than Postgres). The integration pattern lives in `apps/desktop/src-tauri/src/integrations/` + `packages/studio/src/features/integrations/`. Still out of scope: managing databases (create/drop project, create/delete branch) and embedded provider dashboards. The scope notes below are kept for historical context.

## Why

Neon and Supabase users currently copy-paste connection strings from web dashboards. First-class provider integration (sign in, list projects/branches, one-click connect) captures two large, growing user bases. Dora already detects pooler URLs (`is_postgres_pooler_url` in `database/types.rs`), so it is halfway into this world.

## Scope

- **Auth**: API-key based in v1 (Neon API key, Supabase access token), stored via the existing encrypted credential storage (`credentials.rs` / `credential_storage.rs`). OAuth flows are `[!]` follow-up (Neon supports OAuth apps; Supabase requires registration).
- **Neon**: list projects → branches → databases via the Neon public API; create a Dora connection for any branch in one click (connection string fetched from the API, pooler vs direct selectable); show branch metadata (parent, primary, last active) in the picker; **create branch** action (v1 write op, cheap and core to the Neon workflow).
- **Supabase**: list projects via the management API; one-click connect via session pooler string; surface the project's pooler/direct options.
- Connections created this way are tagged with provider origin + project/branch IDs so they can be refreshed when credentials rotate, and display a provider badge in the sidebar.

Out of scope v1: PlanetScale (separate follow-up, MySQL family), managing databases (create/drop project, delete branch), Supabase-specific features (storage, auth tables UI), embedding provider dashboards.

## Safe write scope

- Backend: new `apps/desktop/src-tauri/src/integrations/` module (`neon.rs`, `supabase.rs`, shared HTTP client) + new command file `database/commands/integrations.rs` (+ registration)
- Credential storage: additive entry kinds in `credentials.rs` / `credential_storage.rs`
- Connection metadata: additive optional fields on the stored connection (origin tag) in `storage/serialize.rs`, which must remain backward-compatible with existing saved connections
- Frontend: new flow in `packages/studio/src/features/connections/` ("Add from provider…" entry), provider badge in `packages/studio/src/features/app-sidebar/`

Do not touch the Postgres provider implementation; these produce ordinary Postgres connections.

## Implementation notes

1. API surfaces: Neon `https://console.neon.tech/api/v2/` (projects, branches, connection_uri endpoint); Supabase management API `https://api.supabase.com/v1/projects`. Pin against versioned endpoints, wrap all calls with typed errors: token-expired must surface as "reconnect your Neon account", not a generic failure.
2. Never persist fetched connection strings containing passwords in plaintext: route through the same credential encryption path as manual connections.
3. Rate limits: cache project/branch listings per session; refresh on explicit user action, not on every dialog open.
4. The branch picker should handle hundreds of branches (Neon preview-branch-per-PR workflows): searchable list, primary branch pinned on top.
5. Pooler caveats already handled by `should_skip_named_prepared_statements` / `is_postgres_pooler_url`. Verify Neon's pooler hostname pattern (`-pooler` suffix) and Supabase's (`pooler.supabase.com`) are both matched; extend the detection if not.
6. Marketing tie-in: when this ships, `apps/marketing` feature cards likely want updating. That is out of this spec's write scope, so leave a note in the PR description instead.

## Done when

- With a Neon API key: list projects/branches, create a branch, connect to it, and query it, all without leaving Dora or touching the Neon console.
- With a Supabase token: list projects and connect via pooler in one click.
- Tokens stored encrypted; revoking a token produces the actionable re-auth error; existing saved connections are unaffected by the storage schema addition.
- API clients have unit tests against recorded fixtures (no live API in CI).

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
# manual: free-tier Neon + Supabase accounts, full flow on each
```

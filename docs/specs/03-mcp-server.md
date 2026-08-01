# Spec 03: Dora as an MCP Server

Status: `[ ]`

## Why

Coding agents (Claude Code, Cursor, etc.) are how developers increasingly touch databases. Exposing Dora's saved connections, schema introspection, and (safety-gated) query execution over the Model Context Protocol makes Dora the database layer for those agents, which is distribution no desktop GUI competitor has. Dora's existing dry-run/staging machinery is exactly the safety layer agentic DB access needs.

## Scope

- A local MCP server (stdio + streamable HTTP on localhost) shipped inside the Dora binary, started from a settings toggle ("Enable agent access") and via a headless CLI flag (`dora --mcp-stdio`) so agents can launch it without the GUI.
- Tools (v1):
  - `list_connections`: names, providers, no credentials
  - `get_schema(connection)`: tables/columns/indexes/FKs, reusing `database/services/metadata.rs` and `database/commands/schema.rs`
  - `run_query(connection, sql)`: read-only by default: statements are classified with the existing per-provider `parser.rs`; non-SELECT requires `allow_writes` enabled per connection in settings
  - `stage_mutation` / `preview_mutation`: route writes through the existing dry-run staging path (`database/commands/mutation.rs`) so an agent can propose changes a human approves in the Dora UI
- Per-connection permission model persisted in settings: `off | read_only | read_write`.
- Setup UX: settings page shows copy-paste config snippets for Claude Code / Cursor (`claude mcp add dora -- dora --mcp-stdio`).

Out of scope: remote/network exposure beyond localhost, auth tokens for multi-user, MCP resources/prompts (tools only in v1).

## Safe write scope

- `apps/desktop/src-tauri/src/mcp/` (new module: server, tool defs, permission checks)
- `apps/desktop/src-tauri/src/main.rs` / `lib.rs` (CLI flag, server lifecycle)
- `apps/desktop/src-tauri/src/database/commands/settings.rs` (permission settings)
- Frontend: new settings section in `packages/studio/src/features/` (follow existing settings UI patterns)
- `apps/desktop/src-tauri/Cargo.toml` (official `rmcp` Rust MCP SDK)

## Implementation notes

1. Use the official Rust MCP SDK (`rmcp`). Do not hand-roll the protocol.
2. The MCP layer must call the same service layer the Tauri commands call (`database/services/*`), not duplicate query logic. If a service is only reachable through a Tauri command today, refactor the command into a thin wrapper first.
3. Headless mode: `--mcp-stdio` must work without a window/webview. Audit `init.rs` for GUI-only assumptions (keychain access for credentials is still required, so document that the OS keychain may prompt).
4. Safety defaults: server off by default; new connections default to `read_only` when the server is enabled; every executed statement is recorded in the existing query history with an `agent` origin marker so users can audit what an agent did.
5. Row limits: cap `run_query` results (e.g. 1 000 rows, configurable) and report truncation in the tool result. Agents do not need 1M rows in context.
6. Statement classification: reuse each provider's `parser.rs`; if classification is uncertain, treat as a write.

## Done when

- `claude mcp add dora -- dora --mcp-stdio` works end to end: list connections, fetch schema, run a SELECT, get refused on an UPDATE in read-only mode, stage a mutation that appears in Dora's dry-run UI in read-write mode.
- Permission toggles persist and are enforced; all agent activity is visible in query history.
- Integration tests cover the permission matrix and statement classification.
- Docs page added under `docs/` with setup snippets for Claude Code and Cursor.

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
# manual: register with Claude Code, run the end-to-end flow above against a Docker postgres
```

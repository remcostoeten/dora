# Spec 03: Dora as an MCP Server

Status: `[-]`

Implementation note: the code is on `feat/mcp-server`. It compiles, and a stdio smoke test passes on SQLite, CockroachDB, MySQL, MariaDB and Redis. The Studio UI, proposal approval, Rust test suite and TypeScript checks have not been run. DuckDB is not exposed yet. MySQL and MariaDB have no server-side statement timeout, and `run_query` columns carry names only.

## Goal

Coding agents such as Claude Code and Cursor can use a developer's saved Dora connections over the Model Context Protocol. An agent can list connections, read schema and run bounded read queries. On connections granted `read_write` it can run ordinary writes directly. Destructive writes become proposals that a person approves in the Dora window.

## Decisions

These decisions are settled. Do not reopen them during implementation.

| Topic | Decision |
| --- | --- |
| Transport | stdio only, through `dora --mcp-stdio`. No HTTP listener in this spec. |
| Process model | The agent client launches a separate headless Dora process. It does not attach to a running GUI. |
| Direct writes | `execute_write` runs non-destructive writes on connections granted `read_write`, over a separate write session. |
| Destructive writes | Never run directly. `execute_write` turns them into a proposal, whatever the grant. |
| Proposal path | `propose_change` stores a proposal in Dora's local storage. The GUI shows it, and a person approves or rejects it. |
| Permissions | Per connection: `off`, `read`, `propose` or `read_write`. The default is `off`. |
| Master switch | "Enable agent access" is off by default. With it off, `--mcp-stdio` starts, answers `initialize`, and every tool returns `agent_access_disabled`. |
| Read safety | Three layers: a strict MCP statement policy, session read-only enforcement in the engine, and result limits. `parser.rs` alone is not a safety boundary. |
| Unknown input | Anything the policy cannot parse or classify is refused. |
| PIN-protected connections | Not exposed in this spec. They do not appear in `list_connections` and cannot be granted. |
| Privacy mode | When `privacyMaskData` is on, row-returning tools return `privacy_mode_enabled`. Schema tools keep working. |
| Credentials | Never returned, logged or included in an error message. |
| Binary | The MCP server ships in the main `dora` binary. No separate sidecar, because the database drivers would be linked twice. |

## Out of scope

- HTTP, SSE, WebSocket or any network listener
- Remote access, multi-user access and auth tokens
- MCP resources, prompts, sampling and elicitation
- Direct execution of destructive statements, including an "auto-approve" mode
- KV writes
- Running migrations, dumps, imports, seeding or ORM runners
- Raw Redis or Valkey commands
- Column-level or row-level permissions
- Attaching to the live GUI process

## Current code constraints

The implementation must account for each of these. They were checked against the code when this spec was written.

1. **`is_read_only` is too permissive.** `database/parser.rs` treats every `Statement::Query` as read-only. With the pinned `sqlparser` 0.52, these all classify as read-only:
   - `WITH u AS (UPDATE users SET admin = true RETURNING id) SELECT * FROM u`
   - `SELECT * INTO backup FROM users`
   - `SELECT pg_terminate_backend(123)`, `SELECT setval('users_id_seq', 1)`, `SELECT pg_read_file('/etc/passwd')`
   - SQLite `WITH x AS (SELECT 1) UPDATE users SET admin = 1` and the matching `INSERT`
   - SQLite `WITH x AS (SELECT 1) DELETE FROM users`, which fails AST parsing and reaches the keyword fallback in `database/sqlite/parser.rs`, where a leading `WITH` means read-only
2. **Do not change the existing classifier to fix this.** The GUI depends on its current behavior. The MCP policy is a new, stricter module.
3. **No read-only session enforcement exists.** No engine path sets a read-only transaction or `query_only`.
4. **Dry-run staging is frontend state.** Pending edits live in React state (`packages/studio/src/core/pending-edits/`). `commands/mutation.rs` writes directly. A separate process cannot reach either, so proposals need their own table.
5. **`run()` is GUI startup.** `lib.rs::run` loads `.env` from the current directory, builds Tauri and creates a window. The MCP path must branch off before it. Loading `.env` from an agent's project directory is not acceptable.
6. **stdout is not clean.** `observability::init` uses `fmt::layer()`, which writes to stdout. `println!` also runs in `database/postgres/tls.rs:25` and `database/postgres/connect.rs:201`. Any of these corrupts the stdio protocol.
7. **Opening a connection needs Tauri.** `ConnectionService::open_connection` takes `&ConnectionMonitor`, and `ConnectionMonitor::new` requires an `AppHandle`.
8. **`AppState::new` and `Storage::new` have side effects.** `Storage::new` runs migrations and the legacy Gemini key migration. `AppState::new` also loads the shortcut registry.
9. **`ConnectionInfo` contains secrets.** It carries `connection_string`, `auth_token`, SSH passwords and `pin_hash`. Never serialize it into a tool result.
10. **`QueryService::run_query` submits every statement** and waits only for the first. The MCP path must reject multi-statement input before calling it.
11. **`wait_for_statement` does not cancel on timeout.** It returns while the statement keeps running. The MCP path must call `cancel_queries` itself.
12. **`query_history` has no origin column,** and history is only saved when the frontend calls `save_query_to_history`.
13. **Postgres uses one shared `tokio_postgres::Client` per connection.** Concurrent `BEGIN` and `ROLLBACK` calls on it would interleave.
14. **D1 batches are not atomic.** Its `execute_batch` runs each statement in autocommit. The Postgres, MySQL, SQLite and libSQL adapters use a transaction.
15. **DuckDB allows one read-write process per file.** The MCP process may be unable to open a file the GUI has open.
16. **The Windows release binary uses the GUI subsystem** through `windows_subsystem = "windows"`. stdio must be proven on a real Windows build.

## Architecture

```text
Agent client
    │ stdio (JSON-RPC)
    ▼
dora --mcp-stdio ───────────────┐
    │                           │ grants, audit, proposals
    │ read + write sessions     ▼
    ▼                     Dora storage (SQLite, WAL)
Target databases                ▲
    ▲                           │ polls proposals
    │ approved writes           │
    └────────────────────── Dora GUI
```

### Module layout

```text
apps/desktop/src-tauri/src/mcp/
    mod.rs            run_stdio entry point
    server.rs         rmcp ServerHandler and tool router
    state.rs          McpState and connection cache
    tools/
        connections.rs
        schema.rs
        query.rs
        writes.rs
        proposals.rs
        kv.rs
    policy/
        mod.rs        check_read_statement, check_write, check_proposal
        functions.rs  per-dialect function allowlists
        visitor.rs    AST walk
    session.rs        per-engine read-only session setup
    encode.rs         result limits and value encoding
    grants.rs         master switch and permission checks
    audit.rs          agent history writes
    errors.rs         McpErrorCode
```

### Startup

1. `cli::handle_args` recognizes `--mcp-stdio` and returns a new `StartupAction::RunMcpStdio`.
2. `main.rs` calls `app_lib::mcp::run_stdio()` and exits with its code. It never calls `linux_renderer::configure` or `run`.
3. `run_stdio`:
   - installs the rustls `ring` provider
   - initializes tracing with stderr as the writer, defaulting to `warn`
   - does not load `.env`
   - resolves the active storage path through `AppConfig`
   - opens storage through a new `Storage::open_existing` that runs no migrations
   - exits with code 3 and a stderr message if storage is missing or `user_version` differs from the binary's migration count, telling the user to open Dora once
   - starts `credential_storage::warm_up`
   - serves rmcp over stdin and stdout until stdin closes
4. On shutdown it cancels active statements and closes open connections.

The MCP process must not run migrations. An updated binary could otherwise migrate storage under an older GUI that is still running.

### Required refactors

Keep these behavior-preserving for the GUI and land them first.

- **Logging:** add `observability::init_stderr()`. Replace the two runtime `println!` calls with `log::debug!`.
- **Connection watching:** add a `ConnectionWatcher` trait with `add_connection` and `remove_connection`. Implement it for `ConnectionMonitor` and for a headless watcher in `mcp/state.rs`. `open_connection`, `disconnect_from_database` and `remove_connection` take the trait. The headless watcher keeps check handles, aborts them on removal, and marks the connection disconnected when the check task ends.
- **Connection state:** `McpState` owns `connections`, `schemas`, `schema_locks`, `storage` and `stmt_manager`. Implement `ConnectionRepository` for `McpState` by moving the `AppState` body into a shared helper.
- **Storage:** add `Storage::open_existing`.
- **Last connected:** the MCP path calls `open_connection`, not `connect_to_database`, so it does not update `last_connected_at`.

Keep `tauri::async_runtime::spawn` where it already exists unless a test shows it fails without a Tauri app.

## Permissions

### Storage

Migration `016.sql`:

```sql
ALTER TABLE query_history ADD COLUMN origin TEXT NOT NULL DEFAULT 'user';
ALTER TABLE query_history ADD COLUMN agent_client TEXT;
ALTER TABLE query_history ADD COLUMN agent_proposal_id TEXT;
ALTER TABLE kv_command_history ADD COLUMN origin TEXT NOT NULL DEFAULT 'user';
ALTER TABLE kv_command_history ADD COLUMN agent_client TEXT;

CREATE TABLE agent_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

INSERT INTO agent_settings (id, enabled, updated_at)
VALUES (1, 0, unixepoch());

CREATE TABLE agent_connection_grants (
    connection_id TEXT NOT NULL,
    connection_kind TEXT NOT NULL CHECK (connection_kind IN ('sql', 'kv')),
    permission TEXT NOT NULL CHECK (permission IN ('read', 'propose', 'read_write')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (connection_id, connection_kind)
);

CREATE TABLE agent_proposals (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    statements_json TEXT NOT NULL,
    statements_hash TEXT NOT NULL,
    summary TEXT NOT NULL,
    risk TEXT NOT NULL CHECK (risk IN ('standard', 'destructive')),
    status TEXT NOT NULL CHECK (
        status IN ('pending', 'approved', 'rejected', 'running', 'applied', 'failed', 'expired')
    ),
    agent_client TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    decided_at INTEGER,
    finished_at INTEGER,
    affected_rows INTEGER,
    error_message TEXT,
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_proposals_status
    ON agent_proposals(status, created_at DESC);
CREATE INDEX idx_agent_proposals_connection
    ON agent_proposals(connection_id, created_at DESC);
```

No row in `agent_connection_grants` means `off`. KV, PostHog, DuckDB and file-source connections cannot be granted `read_write`. Deleting a connection must delete its grants in the same transaction, for both SQL and KV connections, because the table has no foreign key.

Do not store grants in `ui_settings`. That document is written by the frontend as a general preferences blob.

### Enforcement

Every tool call rereads the master switch, the grant and `privacyMaskData` from storage. A change in the GUI applies on the next tool call without restarting the agent.

| Tool | Master off | `off` | `read` | `propose` | `read_write` |
| --- | --- | --- | --- | --- | --- |
| `list_connections` | refused | hidden | listed | listed | listed |
| `list_tables`, `describe_table` | refused | refused | allowed | allowed | allowed |
| `run_query` (always read-only) | refused | refused | allowed | allowed | allowed |
| `kv_scan`, `kv_read` | refused | refused | allowed | allowed | n/a |
| `propose_change` | refused | refused | refused | allowed | allowed |
| `execute_write` | refused | refused | refused | refused | allowed |
| `get_proposal` | refused | refused | allowed | allowed | allowed |

A connection that is hidden or refused returns `connection_not_available`. The response must not reveal whether the connection exists.

If the active storage path changes while the process runs, every tool returns `storage_changed` until the agent client restarts the server.

## Tools

Set MCP tool annotations on each tool. All tools set `openWorldHint: false`. All except `propose_change` and `execute_write` set `readOnlyHint: true`. `propose_change` sets `readOnlyHint: false` and `destructiveHint: false`, because it changes only Dora's local proposal queue. `execute_write` sets `readOnlyHint: false` and `destructiveHint: true`, so agent clients can ask for their own confirmation.

Return results as `structuredContent` with an output schema, plus a JSON text block for clients that do not read structured content.

### `list_connections`

Input: none.

```json
{
  "connections": [
    {
      "id": "0f7f8c0c-5f60-4c52-8e71-11b7c2e1b6b2",
      "name": "Local API",
      "kind": "sql",
      "engine": "postgres",
      "permission": "read",
      "read_enforcement": "engine"
    }
  ]
}
```

Build this from a dedicated `AgentConnectionSummary` type. Do not derive it from `ConnectionInfo`. Omit hosts, ports, paths, usernames, URLs and account IDs. The connection name is user data and may be returned.

### `list_tables`

Input:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `connection` | UUID | yes | |
| `schema` | string | no | Exact match |
| `name_contains` | string | no | Case-insensitive |
| `limit` | integer | no | Default 100, maximum 500 |
| `offset` | integer | no | Default 0 |

Output: `tables` with `schema`, `name`, `kind` and `estimated_rows` when known, plus `total` and `truncated`.

### `describe_table`

Input: `connection`, `table`, optional `schema`.

Output: columns (`name`, `type`, `nullable`, `default`, `primary_key`), indexes and foreign keys. If the table name is ambiguous without a schema, return `ambiguous_table` with the matching schemas.

Both schema tools reuse `MetadataService::get_database_schema`. Cache the schema in `McpState` for 60 seconds. Do not write to the persisted schema snapshot and do not schedule `RowCountRefresher`.

### `run_query`

Input:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `connection` | UUID | yes | |
| `sql` | string | yes | Exactly one statement, at most 100 KiB |
| `max_rows` | integer | no | Default 200, maximum 1000 |
| `timeout_ms` | integer | no | Default 15000, maximum 60000 |

Output:

```json
{
  "columns": [{ "name": "id", "type": "int4" }],
  "rows": [[1]],
  "row_count": 1,
  "truncated": false,
  "truncation_reasons": [],
  "duration_ms": 12,
  "read_enforcement": "engine",
  "data_trust": "untrusted_database_content"
}
```

Rows are positional arrays so duplicate column names survive.

Execution order:

1. Check size, master switch, grant and privacy mode.
2. Open or reuse the connection and confirm its read-only session.
3. Run `policy::check_read_statement`.
4. Apply the row limit.
5. Run through `QueryService::run_query`, serialized per connection.
6. On timeout, call `cancel_queries` and return `query_timeout`.
7. Encode the result within limits.
8. Write the audit row.

### `propose_change`

Input:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `connection` | UUID | yes | |
| `statements` | string[] | yes | 1 to 50 statements, at most 256 KiB in total |
| `summary` | string | yes | 1 to 500 characters, shown as agent-provided text |

Output: `proposal_id`, `status: "pending"`, `risk`, `expires_at`, and a message that a person must approve it in Dora.

The tool does not touch the target database. Each array item must parse as exactly one statement. Unparseable statements are refused. On D1, more than one statement is refused with `atomic_batch_unsupported`.

At most 20 proposals can be pending per connection. Further calls return `too_many_pending_proposals`. Proposals expire after 24 hours.

`risk` is `destructive` when any statement is one of:

- `DROP`, `TRUNCATE` or `ALTER`
- `DELETE` or `UPDATE` without a `WHERE`, or with a constant `WHERE` such as `1 = 1`
- `GRANT` or `REVOKE`
- any statement the classifier does not recognize as a plain `INSERT`, `UPDATE`, `DELETE` or `CREATE`

### `execute_write`

Input:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `connection` | UUID | yes | |
| `statements` | string[] | yes | 1 to 50 statements, at most 256 KiB in total |
| `summary` | string | yes | 1 to 500 characters, stored for the audit trail |

Output when executed:

```json
{ "status": "applied", "affected_rows": 3, "duration_ms": 18 }
```

Output when any statement is destructive:

```json
{ "status": "approval_required", "proposal_id": "b7c1...", "risk": "destructive", "expires_at": 1795000000 }
```

Rules:

- `policy::check_write` allows only `INSERT`, `UPDATE`, `DELETE` and `CREATE TABLE`, `CREATE INDEX` or `CREATE VIEW`. Other statements count as destructive.
- The risk rules from `propose_change` apply. If one statement is destructive, nothing runs and the whole batch becomes one proposal.
- The function allowlist applies to the whole AST. The write allowlist adds `nextval`, `gen_random_uuid` and the current date and time functions.
- Execution goes through `MutationService::execute_batch`, so batches are transactional on Postgres, CockroachDB, MySQL, MariaDB, SQLite and libSQL.
- On D1, more than one statement returns `atomic_batch_unsupported`.
- Calls are serialized per connection and time out after 60 seconds.

### `get_proposal`

Input: `proposal_id`.

Output: `status`, `risk`, `created_at`, `expires_at`, `decided_at`, `finished_at`, `affected_rows` and `error_message`. A proposal on a connection the agent can no longer access returns `proposal_not_found`.

### `kv_scan`

Input: `connection`, optional `pattern`, optional `cursor`, optional `limit` (default 100, maximum 500).

Output: keys with type and TTL when available, plus `next_cursor`. Uses `KvService::scan`.

### `kv_read`

Input: `connection`, `key`, optional `max_items` (default 100, maximum 500).

Output: the typed value with the same byte limits as `run_query`. Uses `KvService::read`. `classify_raw_command` and raw command execution are not reachable from MCP.

Binary keys and values use `{ "encoding": "base64", "value": "..." }`. KV tools return `privacy_mode_enabled` when privacy mode is on, because keys can contain user data.

## Read statement policy

`policy::check_read_statement(dialect, sql)` returns the single approved statement or a refusal. It uses `sqlparser` with the `visitor` feature enabled and never uses a keyword fallback.

### Allowed top-level statements

- `Statement::Query`
- `EXPLAIN` without `ANALYZE`, with an allowed inner statement
- `SHOW` forms that are already read-only in `SqlDialectExt`, except for variable forms that reveal server configuration (`ShowVariable`, `ShowVariables`, `ShowStatus`)

Everything else is refused, including `SET`, `BEGIN`, `COMMIT`, `ROLLBACK`, `DECLARE`, `FETCH`, `CALL`, `COPY`, `ATTACH`, `PRAGMA`, `VACUUM`, `LOAD` and `INSTALL`.

### Query body rules

Walk the entire AST, including CTEs, subqueries, set operations, joins and expressions. Refuse if any of these appear:

- `SetExpr::Insert`, `SetExpr::Update` or any non-query body
- `SELECT ... INTO`
- locking clauses such as `FOR UPDATE` and `FOR SHARE`
- a function not on the dialect allowlist
- a schema-qualified function outside the dialect's system namespace
- a table function, unless allowlisted
- a table reference that is a string or file path, including DuckDB replacement scans such as `FROM 'file.csv'`

### Function allowlist

Functions are default-deny. `policy/functions.rs` holds one allowlist per dialect, covering deterministic or stable built-ins:

- aggregates
- string, numeric and date functions
- conditional functions (`coalesce`, `nullif`, `greatest`, `least`)
- JSON read functions
- window functions

Names compare case-insensitively after removing a `pg_catalog.` prefix. User-defined functions are refused.

Tests must prove these stay refused on their dialect:

| Dialect | Functions |
| --- | --- |
| Postgres, CockroachDB | `set_config`, `setval`, `nextval`, `pg_sleep`, `pg_terminate_backend`, `pg_cancel_backend`, `pg_read_file`, `pg_read_binary_file`, `pg_ls_dir`, `pg_advisory_lock`, `pg_reload_conf`, `lo_import`, `lo_export`, `dblink`, `query_to_xml` |
| MySQL, MariaDB | `load_file`, `sleep`, `benchmark`, `get_lock`, `release_lock` |
| SQLite, libSQL, D1 | `load_extension`, `readfile`, `writefile`, `fts3_tokenizer` |
| DuckDB | `read_csv`, `read_csv_auto`, `read_parquet`, `read_json`, `read_json_auto`, `read_text`, `read_blob`, `glob`, `getenv` |

### Row limit

The policy returns the parsed `Query`. Set its `limit` to `max_rows + 1`, or to the smaller of that and the user's literal limit. If the user's limit is not a literal, refuse with `unsupported_limit`. Serialize the modified AST and run that text. Audit the original SQL.

Requesting one extra row detects truncation. The extra row is never returned.

If serialized SQL no longer parses to the same statement kind, refuse rather than run it.

## Engine read enforcement

`session.rs` configures each connection after opening it and before the first tool call uses it. If setup fails, the connection is unavailable.

| Engine | Enforcement | `read_enforcement` |
| --- | --- | --- |
| Postgres, CockroachDB | `SET default_transaction_read_only = on`, `SET statement_timeout = 60000`, `SET idle_in_transaction_session_timeout = 10000` | `engine` |
| MySQL | `SET SESSION TRANSACTION READ ONLY`, `SET SESSION MAX_EXECUTION_TIME = 60000` on every pooled connection | `engine` |
| MariaDB | `SET SESSION TRANSACTION READ ONLY`, `SET SESSION max_statement_time = 60` on every pooled connection | `engine` |
| SQLite, local libSQL | `PRAGMA query_only = ON`, `PRAGMA busy_timeout = 2000` | `engine` |
| DuckDB file | Open with read-only access | `engine` |
| DuckDB file sources | In-memory views, existing `read_only` flag, policy refuses file access | `engine` |
| Remote libSQL, D1 | Statement policy only | `policy_only` |
| PostHog | Read-only HogQL API | `api` |
| Redis, Valkey | Typed read methods only | `api` |

Verify the session value after setting it, for example `SHOW default_transaction_read_only`. Set MySQL and MariaDB session values through the connection pool's per-connection setup so a new pooled connection cannot skip them.

Read tools on a connection are serialized with a per-connection `tokio::sync::Mutex`, at most one running statement at a time.

`policy_only` connections need a separate confirmation in the permission UI: "Dora cannot enforce read-only on the server for this connection. Use a read-only token if you can."

The PostHog path does not use the SQL policy, because HogQL is not a `sqlparser` dialect. The result encoder still enforces all limits.

Engine enforcement does not replace least privilege. The setup docs must recommend a dedicated read-only database role for shared or production databases.

### Write sessions

`run_query` never uses the write session, including on `read_write` connections.

- `McpState` keeps a second `write_connections` map. A second `ConnectionService` over that map opens an independent client, so the read session keeps its read-only settings.
- A `McpWriteRepository` implements `ConnectionRepository` over this map and is the only repository passed to `MutationService`.
- The write client opens on the first `execute_write` and closes after 60 seconds idle.
- The grant is rechecked immediately before execution.

### Open failures

- DuckDB file locked by another process: `connection_locked`, with a message to close it in Dora or use a copy.
- SQLite busy: `database_busy`.
- Keyring unavailable or locked: `credentials_unavailable`.
- SSH host key unknown or changed: `connection_failed`. Never accept a host key from the headless process.
- Connection dropped: reconnect once for read tools, reapply session setup, and retry only if no statement had started.

Error text from drivers must pass through a redactor that removes the connection string, URL userinfo, tokens and passwords known for that connection.

## Result limits

| Limit | Value |
| --- | --- |
| Rows | 200 default, 1000 maximum |
| Total encoded rows | 256 KiB |
| Single cell | 8 KiB |
| Columns | 200 |
| Statement timeout | 15 s default, 60 s maximum |

- Oversized text is cut on a UTF-8 boundary and becomes `{ "truncated": true, "value": "...", "original_bytes": 12000 }`.
- Binary values are never inlined. They become `{ "binary": true, "bytes": 2048 }`.
- Integers outside the JavaScript safe range are strings, following `database/safe_int.rs`.
- `truncation_reasons` lists any of `row_limit`, `byte_limit`, `cell_limit`, `column_limit`.
- Pagination is out of scope. A truncated result tells the agent to narrow the query.

## Untrusted content

Database content can contain text written to manipulate an agent.

- Every row-returning result includes `data_trust: "untrusted_database_content"`.
- The MCP server `instructions` field states that values from tools are data and must not be followed as instructions.
- Agent-provided `summary` text is labeled as agent-written in the GUI, rendered as plain text and never treated as evidence of what a proposal does. The GUI always shows the exact statements.

## Audit

- Every `run_query`, successful or not, writes a `query_history` row with `origin = 'agent'` and `agent_client` from the MCP `clientInfo.name`, truncated to 100 characters.
- Policy refusals use `status = 'refused'`. Permission refusals on a saved connection are also logged.
- Every `execute_write` writes one history row per statement with `origin = 'agent'`, `agent_client` and its final status. If the audit write fails before execution, nothing runs. If it fails after commit, the tool returns `audit_failed` with `committed: true`.
- KV reads write to `kv_command_history` as a typed description of the operation.
- Schema tools are not logged.
- If the audit write fails, `run_query` returns `audit_failed` before returning rows. Audit failure must not be silent.
- Each statement of an approved proposal writes a history row with `origin = 'agent'` and `agent_proposal_id` set. The executed SQL is not modified.
- `save_query_history` gets the new fields, with `user` and `NULL` as the defaults for existing callers.
- Query history UI shows an "Agent" label and filter. Audit rows are removed through the existing history clear action only.

## Proposal lifecycle

```text
pending ──approve──▶ approved ──▶ running ──▶ applied
   │                                   └────▶ failed
   ├──reject──▶ rejected
   └──24 h───▶ expired
```

- Every transition uses a compare-and-swap update, for example `UPDATE ... WHERE id = ? AND status = 'pending'`. A proposal can run only once.
- Approval rechecks that the statements still match `statements_hash`, the grant is still `propose` or `read_write`, the master switch is on and the proposal has not expired.
- The GUI requires an open connection and offers to connect if needed.
- Execution goes through `MutationService::execute_batch`, then follows the same cache cleanup as the `execute_batch` command.
- A proposal left in `running` after a crash becomes `failed` at next GUI start with the message "Dora closed before the result was recorded. Check the database before retrying." It is never retried automatically.
- Destructive proposals require typing the connection name to approve.
- D1 proposals contain one statement, so atomicity is not in question.

New Tauri commands, thin wrappers over an `AgentService`:

- `get_agent_settings`, `set_agent_enabled`
- `list_agent_grants`, `set_agent_grant`
- `list_agent_proposals`, `approve_agent_proposal`, `reject_agent_proposal`
- `get_agent_setup_info`

Register them in both `generate_handler!` and `collect_commands!`, then regenerate `packages/studio/src/lib/bindings.ts`. Add an `isTauri` guarded mock for browser mode.

## Studio UI

### Settings

Add an `agent-access` section to `packages/studio/src/features/settings/sections.ts`, in the Application group, with a screen in `screens/agent-access-screen.tsx`:

- master switch with a plain description of what agents can do
- connection list with `Off`, `Read`, `Propose` and `Read and write` per connection
- a confirmation before the first `Read and write` grant on a connection, stating that agents can change data without review and that destructive statements still need approval
- PIN-protected connections shown disabled with the reason
- `policy_only` confirmation before the first grant
- setup snippets from `get_agent_setup_info`, with a copy button
- a warning when privacy mode blocks row access

Turning the master switch off does not clear grants.

### Proposals

- A sidebar or status bar indicator shows the pending count while agent access is on.
- The GUI polls `list_agent_proposals` every 3 seconds while focused and on window focus. Polling stops when agent access is off.
- The review dialog shows connection, agent client, summary, risk and the exact SQL with syntax highlighting. Reuse the presentation from `pending-sql-preview-dialog.tsx`.
- Approve, Reject and result states are keyboard reachable.
- Agent activity shows recent proposals, direct writes and their outcomes.
- The same poll detects new agent writes. It refreshes affected grids unless they have pending edits, and invalidates the schema cache after DDL.

## Setup and packaging

`get_agent_setup_info` returns the command for the current install:

| Install | Command |
| --- | --- |
| deb, rpm, AUR | `dora --mcp-stdio` |
| AppImage | Absolute path from `APPIMAGE`, then `--mcp-stdio` |
| Flatpak | `flatpak run io.github.remcostoeten.dora --mcp-stdio` |
| Snap | `snap run dora --mcp-stdio` |
| macOS | `/Applications/Dora.app/Contents/MacOS/dora --mcp-stdio`, using the real running path |
| Windows | Absolute path of the running executable, then `--mcp-stdio` |

Snippets:

```bash
claude mcp add dora -- dora --mcp-stdio
```

```json
{
  "mcpServers": {
    "dora": {
      "command": "dora",
      "args": ["--mcp-stdio"]
    }
  }
}
```

Packaging requirements:

- `packaging/snap` `bin/launch` must pass arguments through and keep stdout clean.
- The Flatpak and Snap entry points must not print to stdout before Dora starts.
- Windows must prove JSON-RPC over redirected pipes from the GUI-subsystem release binary. If it fails, stop and mark this spec `[!]` with the failure. Do not switch the app to the console subsystem, which opens a console window.
- `dora --help` lists `--mcp-stdio`.

## Implementation phases

Each phase is one reviewable PR and leaves the app working.

### Phase 0: Headless foundation

- Clean stdout, add `init_stderr`, `Storage::open_existing` and `ConnectionWatcher`.
- Add migration 016 and history fields.
- Add `--mcp-stdio`, `rmcp` and a server with no data tools.

Done when an MCP client completes `initialize` from a clean process with no window and no stdout noise.

### Phase 1: Read access for SQL engines

- Add grants, `list_connections`, `list_tables`, `describe_table`.
- Add the statement policy, session enforcement, `run_query`, result limits, redaction and audit.

Grants can be seeded in tests until Phase 2. Release builds keep the feature unreachable because the master switch has no UI and defaults off.

Scope: Postgres, CockroachDB, MySQL, MariaDB, SQLite and local libSQL. Done when the read matrix passes on each of them, using the containers in `docker-compose.databases.yml` for the server engines.

### Phase 2: Settings and audit UI

- Add Tauri commands, the settings screen, setup snippets and history labels.
- Update `docs/` with the setup guide.

Done when a user can enable agent access from the UI and connect Claude Code. This is the first shippable release.

### Phase 3: Proposals and writes

- Add `propose_change`, `get_proposal`, `AgentService`, the review dialog and crash recovery.
- Add `execute_write`, `policy::check_write`, write sessions, the `read_write` grant and GUI refresh after agent writes.

### Phase 4: KV and remaining engines

- Add `kv_scan`, `kv_read`, DuckDB lock handling and the `policy_only` flow for remote libSQL and D1.
- Add PostHog read support.

Until this phase ships, unsupported connections show "Not available yet" and cannot be granted.

## Safe write scope

- `apps/desktop/src-tauri/src/mcp/` (new)
- `apps/desktop/src-tauri/src/main.rs`, `cli.rs`, `lib.rs`, `bindings.rs`, `observability.rs`
- `apps/desktop/src-tauri/Cargo.toml`, `Cargo.lock`
- `apps/desktop/src-tauri/migrations/016.sql`, `src/storage/migrator.rs`, `src/storage/mod.rs`, `src/storage/queries.rs`
- `apps/desktop/src-tauri/src/database/connection_monitor.rs`, `connection_repository.rs`
- `apps/desktop/src-tauri/src/database/services/connection.rs`, `services/mutation.rs`
- `apps/desktop/src-tauri/src/database/postgres/tls.rs`, `postgres/connect.rs`
- `apps/desktop/src-tauri/src/database/commands/` (new agent commands, re-exports)
- `packages/studio/src/features/settings/`
- `packages/studio/src/features/agent-access/` (new)
- `packages/studio/src/lib/bindings.ts` (generated only)
- Query history UI in `packages/studio/src/features/sql-console/`
- `packaging/snap/`, `packaging/flatpak/` if argument passthrough needs a fix
- `docs/guides/agent-access.mdx`, `docs/guides/meta.json`, `docs/guides/security.mdx`
- `docs/specs/README.md`, `docs/product-roadmap.md`, `CHANGELOG.md`

Do not edit `database/parser.rs` or a provider `parser.rs` for this spec.

## Dependencies

```toml
rmcp = { version = "3.11", default-features = false, features = ["server", "macros", "transport-io"] }
sqlparser = { version = "0.52", features = ["serde", "visitor"] }
```

Use the official Rust MCP SDK. Do not hand-roll the protocol. `rmcp` 3.11 requires Rust 1.88. Confirm the current release at implementation time and check whether the added dependencies change binary size in a release build.

## Error codes

Tools return MCP tool errors (`isError: true`) with this structure:

```json
{
  "code": "statement_not_allowed",
  "message": "Only one read-only statement is allowed.",
  "retryable": false
}
```

| Code | Retryable |
| --- | --- |
| `agent_access_disabled` | no |
| `connection_not_available` | no |
| `permission_denied` | no |
| `privacy_mode_enabled` | no |
| `storage_changed` | no |
| `invalid_input` | no |
| `parse_failed` | no |
| `multiple_statements` | no |
| `statement_not_allowed` | no |
| `function_not_allowed` | no |
| `unsupported_limit` | no |
| `ambiguous_table` | no |
| `atomic_batch_unsupported` | no |
| `write_not_supported` | no |
| `too_many_pending_proposals` | no |
| `proposal_not_found` | no |
| `credentials_unavailable` | no |
| `connection_failed` | yes |
| `connection_locked` | yes |
| `database_busy` | yes |
| `query_timeout` | yes |
| `query_failed` | no |
| `audit_failed` | yes |

## Tests

### Unit

- Every example in "Current code constraints" item 1 is refused.
- Policy on every dialect: top-level statement matrix, nested CTE writes, `SELECT INTO`, locking clauses, multiple statements, comments hiding a second statement, quoted identifiers, mixed case and unparseable input.
- Function allowlist, including every entry in the refusal table and schema-qualified names.
- Limit rewriting: no limit, lower limit, higher limit, non-literal limit, `UNION`, CTEs and duplicate column names.
- Encoder: row, byte, cell and column limits, UTF-8 boundaries, binary values and large integers.
- Redactor: connection strings, URL userinfo, tokens and SSH passwords in driver errors.
- Full grant matrix, including live revocation between two calls.
- `list_connections` serialization contains no secret from a fully populated `ConnectionInfo`.
- Write policy: allowed kinds, destructive routing, constant `WHERE`, a mixed batch that must run nothing, and denied functions inside `INSERT` and `UPDATE`.
- Proposal state machine: double approval, approval after expiry, hash mismatch, revoked grant and crash recovery.

### Integration

Spawn the built binary and speak MCP over pipes:

- stdout contains only valid JSON-RPC, including during connection failures
- no window, WebView or Tauri app starts
- storage with a wrong `user_version` exits with code 3 and is not modified
- `.env` in the current directory is not loaded

### Live

Add tests to `apps/desktop/src-tauri/tests/`, gated behind `DORA_LIVE_DB_TESTS=1`, for Postgres, MySQL, MariaDB, CockroachDB, libSQL, Redis and Valkey:

- a `SELECT` returns rows
- a write that bypasses the policy test hook is refused by the engine session on every `engine` connection
- the target data is unchanged after the full refusal suite
- timeout cancels the statement on the server
- `execute_write` commits on a `read_write` grant, rolls back a failing batch, and leaves the read session read-only afterward
- a destructive `execute_write` changes nothing until approved
- an approved proposal applies once, and a failing batch rolls back on transactional engines

### Frontend

- settings screen states and grant changes
- destructive proposal confirmation
- polling stops when agent access is off
- keyboard access through the review dialog

## Done when

- `claude mcp add dora -- dora --mcp-stdio` works from a clean terminal with the GUI closed.
- With access enabled and a `read` grant, an agent can list the connection, inspect a table and run a `SELECT`.
- On a `read` grant, `UPDATE`, every bypass in "Current code constraints" item 1 and every denied function are refused.
- On a `read_write` grant, an `UPDATE ... WHERE` commits and appears in Dora, and a `DROP TABLE` becomes a proposal without changing the database.
- A write is also blocked by the engine session on every connection labeled `engine`.
- A `propose_change` appears in the running GUI, cannot run without approval, and applies exactly once after approval.
- Grants, the master switch and privacy mode apply on the next tool call.
- All agent queries, refusals and proposals are visible in Dora.
- No tool result, log line or error contains a credential.
- stdio works on Linux, macOS and Windows release builds, plus AppImage, Flatpak and Snap.
- A docs page covers setup for Claude Code and Cursor, permissions, limits and the read-only database role recommendation.
- `docs/specs/README.md`, `docs/product-roadmap.md` and `CHANGELOG.md` are updated.

## Validation

```bash
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets
PATH="/usr/bin:$PATH" cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
docker compose -f docker-compose.databases.yml up -d --wait
DORA_LIVE_DB_TESTS=1 PATH="/usr/bin:$PATH" cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test mcp_live_tests
bun run --cwd packages/studio test
```

Manual check:

```bash
claude mcp add dora -- /absolute/path/to/dora --mcp-stdio
```

Run the flow from "Done when" against the Docker Postgres container, with the GUI closed for the read flow and open for the proposal flow.

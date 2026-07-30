# Tauri boundary — reference

Overflow for `SKILL.md`. Rules live there; this file is lookup material.

## Error tags

`Error::tag()` in `apps/desktop/src-tauri/src/error.rs` is the full mapping from
variant to the `kind` string the frontend sees. Several variants share a tag.

| Tag | Variants that produce it |
| --- | --- |
| `ConnectionNotFound` | `ConnectionNotFound(Uuid)` |
| `ConnectionFailed` | `ConnectionFailed(String)` |
| `AuthFailed` | `AuthFailed` |
| `PermissionDenied` | `PermissionDenied(String)` |
| `Driver` | `Driver { kind, message }`, `Rusqlite`, `Postgres`, `MySQL`, `DuckDB` |
| `Serialization` | `Serialization(String)`, `Json` |
| `Cancelled` | `Cancelled` |
| `Timeout` | `Timeout { ms }` |
| `NotImplemented` | `NotImplemented(&'static str)` |
| `InvalidInput` | `InvalidInput(String)` |
| `Io` | `Io(String)` |
| `Internal` | `Internal(String)`, `Any`, `Tauri`, `Fmt` |

`DatabaseKind`, the discriminator inside `Driver`, is a separate and narrower
enum than the engine enums elsewhere in the backend. Adding an engine does not
oblige a `DatabaseKind` variant.

`detail` is always `self.to_string()`, i.e. the `#[error(...)]` format string for
that variant. It is user-facing prose and changes freely.

Two `From` impls matter at the boundary:

- `SendError<T>` maps to `Cancelled`. A dropped results channel is normal
  shutdown, not a failure.
- `std::io::Error` maps to `Io(String)`, not to a transparent wrapper.

`impl specta::Type for Error` forwards to `BackendErrorShape`, which is why
TypeScript sees `{ kind: string; detail: string }` and not a union of variants.
A new variant does not change the TypeScript type; only the runtime value of
`kind` changes.

## What crosses as what

| Payload | Representation |
| --- | --- |
| Row page | `Page = Box<RawValue>`, conceptually `Vec<Vec<Json>>` |
| First page on `StatementInfo` | `first_page`, typed to specta as `JsonValue` |
| Column names | JSON-serialized `Vec<String>` carried as a `RawValue` |
| Mutation outcome | `MutationResult { success, affected_rows, message }` |
| Blob cell, on demand | `Vec<u8>`, i.e. a JSON array of numbers |
| Blob cell, in the grid | display string from `blob_display.rs` |
| AI token stream | `Channel<AiStreamEvent>` |
| Ollama pull and install progress | `Channel<OllamaPullEvent>`, `Channel<OllamaInstallEvent>` |

`fetch_page` deserializes the stored `RawValue` into a `serde_json::Value` before
returning it, falling back to `Value::Null` on a parse failure, so the page is
parsed and re-serialized on the way out. That is the cost to keep in mind before
enlarging a page or adding a command that returns rows in bulk.

## Field casing

Both appear on the wire, decided per struct by serde attributes:

- snake_case, no attribute — `ConnectionInfo { database_type, last_connected_at,
  pin_hash, sort_order }`, `SavedQuery`, `QueryHistoryEntry`, `MutationResult`,
  `StatementInfo`.
- camelCase, `#[serde(rename_all = "camelCase")]` — `DatabaseConnectResult
  { fileSources }`, `DataFileSourceEntry { viewName, fileType }`,
  `SaveDataFileSessionResult`.

Command *arguments* are unaffected by this: they are always camelCase on the
wire regardless of the Rust parameter name, because tauri-specta renames them.
`ai_keys_add(provider, label, api_key)` is invoked with `{ provider, label,
apiKey }`.

Enums serialize in three shapes here, all visible in the generated bindings:

- externally tagged by default — `DatabaseInfo` becomes
  `{ Postgres: { ... } } | { SQLite: { ... } } | ...`, which is why frontend code
  tests membership with `'Postgres' in databaseType`.
- unit enums with `#[serde(rename_all = "snake_case")]` become a string union —
  `CredentialStorageBackend`, `DatabaseKind`.
- internally tagged with `#[serde(tag = "type")]` become a discriminated union —
  `AiStreamEvent`, `OllamaPullEvent`, `OllamaInstallEvent`.

`QueryStatus` carries no rename and crosses as `"Pending" | "Running" |
"Completed" | "Error"`.

## Anatomy of a streaming command

Reference implementation: `ai_complete_stream` in
`apps/desktop/src-tauri/src/database/commands/ai.rs`, consumed by
`packages/studio/src/features/sql-console/components/ai-cmd-k.tsx`.

Rust side:

1. Signature takes `request_id: String` first and
   `on_event: tauri::ipc::Channel<AiStreamEvent>` after the ordinary arguments,
   with `state: State<'_, AppState>` last. It returns `Result<(), Error>`.
2. The event enum is `#[derive(Serialize, specta::Type)]` with
   `#[serde(tag = "type", rename_all = "snake_case")]` and has both a terminal
   variant and an error variant. `AiStreamEvent` is `token`, `final`, `error`.
3. The command inserts an `Arc<AtomicBool>` into the cancel-flag map on
   `AppState` under `request_id`, and the streaming loop observes it.
4. A separate command clears it — `ai_abort_stream`, `ai_cancel_ollama_pull`,
   `ai_cancel_ollama_install`.

TypeScript side:

1. `import { Channel } from '@tauri-apps/api/core'` and construct
   `new Channel<AiStreamEvent>()`. The generated binding types the parameter as
   `TAURI_CHANNEL<T>`, which is a phantom alias for `null`, so the real
   constructor has to come from the Tauri package.
2. Assign `channel.onmessage` and switch on `event.type` before calling the
   command; messages can arrive as soon as the invoke starts.
3. Pass the channel as the matching argument to `commands.*` and still check
   `result.status` — that result reports failure to start, while failures during
   the stream arrive as an `error` event.

## Registration sites, exhaustively

For one command named `foo`:

1. `#[tauri::command]` and `#[specta::specta]` on `pub async fn foo` in a surface
   module under `apps/desktop/src-tauri/src/database/commands/`, or in
   `apps/desktop/src-tauri/src/window/commands.rs`, or under
   `apps/desktop/src-tauri/src/commands/`.
2. `pub mod` and `pub use <module>::*` in the surface's `mod.rs` — for database
   commands that is `apps/desktop/src-tauri/src/database/commands/mod.rs`, which
   glob-re-exports every surface.
3. `database::commands::foo` in `generate_handler!` in
   `apps/desktop/src-tauri/src/lib.rs`.
4. `db_commands::foo` in `collect_commands!` in
   `apps/desktop/src-tauri/src/bindings.rs`. Commands outside the database
   surface are listed by full path, e.g. `crate::commands::build_cache::clean_build_cache`.
5. The generated TypeScript, as `async foo(...)` on the `commands` object.

Not a registration site: `apps/desktop/src-tauri/capabilities/default.json`. It
enumerates core and plugin permissions (`core:default`, `dialog:allow-save`,
`fs:allow-exists`, `shell:allow-spawn` for docker, `updater:default`) and does
not gate application commands.

`generate_bindings` and `export_ts_bindings` are both
`#[cfg(any(debug_assertions, test))]`, so binding generation exists in debug
builds and tests only. `bindings.rs` also carries an `#[ignore]`d test,
`export_bindings`, that calls the exporter.

## Frontend consumption points

- `packages/studio/src/lib/bindings.ts` — `commands`, `Result<T, E>`, and every
  generated type. The only module that imports `invoke`.
- `packages/studio/src/core/data-provider/types.ts` — `DataAdapter`, and
  `AdapterResult<T>`, which flattens `{ kind, detail }` down to a single
  `error: string`. The `kind` discriminator does not survive that translation, so
  code that needs to branch on it must read the binding result before the
  adapter does.
- `packages/studio/src/core/data-provider/adapters/tauri.ts` and
  `packages/studio/src/core/data-provider/adapters/mock.ts` — the two
  implementations that must stay in step.
- `packages/studio/src/shared/utils/backend-error.ts` — `formatBackendError`,
  `isBackendErrorShape`, `toError`.

---
name: dora-tauri-boundary
description: The IPC wire between the studio frontend and the Rust backend. Use when adding, renaming or removing a Tauri command; changing a command's arguments or return type; changing a type that crosses IPC (serde attributes, specta derives, generated bindings); changing how a backend error is represented, serialized or read; or choosing between a JSON response, raw bytes and a streaming Channel. Not for query lifecycle, polling or paging behaviour (dora-query-pipeline), and not for grid rendering (dora-data-grid).
---

# Tauri boundary

## Scope

This skill owns the wire: command signatures, request and response types, serde
representation, the error shape, and what a payload costs to serialize.

It does not own what happens on either side of the wire. Statement lifecycle,
cancellation semantics, polling and page assembly belong to `dora-query-pipeline`.
Rendering a value once it has arrived belongs to `dora-data-grid`.

## Unencodable

No rule is given for these. Ask before deciding.
- Whether a new command must also be listed in `get_command_contract()` in
  `apps/desktop/src-tauri/src/database/contract.rs` (FINDINGS 4.18).
- Which runtime guard to place in front of a direct `commands.*` call; three
  detections exist (FINDINGS 4.10).
- Whether existing raw `invoke` call sites should be migrated (FINDINGS 4.3).

## Workflow

Adding or changing a command, in order:

1. Write the function in the surface module it belongs to, under
   `apps/desktop/src-tauri/src/database/commands/`, or
   `apps/desktop/src-tauri/src/window/commands.rs`, or
   `apps/desktop/src-tauri/src/commands/` for non-database surfaces. Mark it
   `#[tauri::command]` and
   `#[specta::specta]`, take `state: State<'_, AppState>` last, return
   `Result<T, Error>` using `crate::error::Error`.
2. Keep the body thin: build the service (`QueryService`, `MutationService`,
   `ConnectionService`, `AIService`) from `state.inner()` and delegate. Driver
   work does not live in a command.
3. Derive `specta::Type` plus the serde traits the direction needs on every type
   in the signature. Arguments need `Deserialize`, returns need `Serialize`.
4. Re-export from `apps/desktop/src-tauri/src/database/commands/mod.rs`; both
   registration lists name commands through `db_commands::<name>`.
5. Register in `generate_handler!` in `apps/desktop/src-tauri/src/lib.rs`.
   Without it the command does not exist at runtime.
6. Register in `collect_commands!` in `apps/desktop/src-tauri/src/bindings.rs`.
   Without it no TypeScript binding is generated.
7. Call it from the frontend as `commands.<camelCaseName>` imported from
   `@studio/lib/bindings`, and branch on `result.status`.

No capability entry is needed. `apps/desktop/src-tauri/capabilities/default.json`
lists core and plugin permissions only; application commands are not gated there.

## Invariants

**The generated wrapper is the only importer of `invoke`.** Every other module
calls `commands.<name>` from `@studio/lib/bindings`. The wrapper is the only
place that knows the wire spelling — the command name stays snake_case while
argument keys become camelCase (`api_key` crosses as `apiKey`) — and the only
place that converts a rejection into a value instead of a throw. Importing
`Channel` from `@tauri-apps/api/core` is fine and required; importing `invoke`
is not.

**The Studio binding is canonical.** `export_ts_bindings` writes directly to
`packages/studio/src/lib/bindings.ts`, using `CARGO_MANIFEST_DIR` so the result
does not depend on the caller's working directory. The desktop-local binding
file is only a compatibility re-export. Regenerate after every IPC change and
make CI fail when regeneration changes the canonical file.

**If `DataAdapter` declares the operation, go through the adapter.** Components
reach it with `useAdapter()` from `packages/studio/src/core/data-provider/context.tsx`,
never `commands.*`, because `packages/studio/src/core/data-provider/adapters/mock.ts`
is the second implementation and a direct call breaks the mock build. Operations
`packages/studio/src/core/data-provider/types.ts` does not declare — AI, storage,
settings, credential storage, blob fetch — call `commands.*` directly. Adding a
method to `DataAdapter` obliges both adapters.

**Errors are values, not throws.** A command returns `Result<T, Error>` with the
crate `Error` — never `Result<T, String>`, never a panic or an `unwrap` (the
crate carries `#![warn(clippy::unwrap_used)]`). The hand-written `Serialize` impl
in `apps/desktop/src-tauri/src/error.rs` emits exactly two keys, `kind` and
`detail`. On the frontend a binding resolves to `{ status: 'ok' }` or
`{ status: 'error' }`; a value thrown out of a binding is a real JS `Error`,
which means a frontend bug, not a backend failure. Do not wrap a
`commands.*` call in try/catch to read a backend error.

**`kind` is the contract, `detail` is prose.** `Error::tag()` maps variants onto
a closed set of tags and is documented as stable. Branch on `kind`; never parse
`detail`, which is a `Display` string. A new variant adds a `tag()` arm and
reuses an existing tag when the meaning already exists (`Json` reports as
`Serialization`; every driver error reports as `Driver`).

**Choose a typed variant.** `Error::Internal` and the transparent `anyhow`
wrapper both surface as `Internal`, which erases the discriminator. Reach for
`ConnectionNotFound`, `InvalidInput`, `PermissionDenied`, `NotImplemented`,
`Timeout`, `Cancelled` first.

**A non-`Result` command generates a binding with no `status` field.** That is
correct only for a genuinely infallible command such as
`get_credential_storage_status`. Anything that can fail returns `Result`.

**JSON, one response per call, is the default.** Rows cross as pages of
`Box<RawValue>` (`Page` in `apps/desktop/src-tauri/src/database/types.rs`);
`fetch_page` parses that back into a `serde_json::Value` before returning, so a
page pays serialization twice. Do not widen a page or add a command that returns
a whole result set.

**A `Channel` is for N items over time, not for making one big response feel
faster.** Use `tauri::ipc::Channel<T>` only when the UI must show progress
before completion; today that is AI token streams and Ollama pull and install
progress in `apps/desktop/src-tauri/src/database/commands/ai.rs`. A channel
command takes `request_id: String`, types the channel to a `#[serde(tag = "type",
rename_all = "snake_case")]` enum with a terminal variant and an error variant,
returns `Result<(), Error>`, and has a paired cancel command that flips the flag
this request id owns in the matching `AppState` map. Stream failures travel as
an event; the `Result` reports only failure to start. Pagination, not streaming,
is the answer for a large finite result.

**Raw bytes are single-cell and on demand.** `Vec<u8>` crosses as a JSON array
of numbers, so `get_blob_bytes` is keyed by primary key and fires on explicit
user action. A scan or grid path never returns bytes; it renders the display
string from `apps/desktop/src-tauri/src/database/blob_display.rs`.

**Field names come from the type, not from a convention.** Both casings are in
use — `ConnectionInfo` crosses snake_case, `DatabaseConnectResult` crosses
camelCase because the struct carries `#[serde(rename_all = "camelCase")]`. Never
spell a field by hand on the frontend; import the type from `@studio/lib/bindings`.

**Rust re-validates everything it acts on.** TypeScript validation is for the
form, not for safety: the zod schemas in
`packages/studio/src/features/connections/validation.ts` shape input before the
call. Any path, identifier or credential the backend will act on is validated
again in Rust with a typed error — see `validate_entry_name` plus the
`canonicalize` containment check in `apps/desktop/src-tauri/src/commands/build_cache.rs`,
and the `is_file` plus byte-cap checks in `apps/desktop/src-tauri/src/window/commands.rs`.
Size limits are Rust-side; the frontend cannot enforce them. An identifier that
gets interpolated into SQL is quoted with `database::ident`, not checked with a
string test.

## Common mistakes

- Adding the command to `generate_handler!` only. It works in the running app
  and has no binding, so the studio cannot call it.
- Adding it to `collect_commands!` only. The binding exists and the invoke
  rejects at runtime.
- Forgetting the `pub use` in `apps/desktop/src-tauri/src/database/commands/mod.rs`,
  which fails both lists at once.
- Returning `Result<T, String>` or `anyhow::Result`. It compiles, and every
  caller then sees `kind` as `Internal`.
- Reading `error.detail` to decide what happened, instead of `error.kind`.
- Rendering a backend error with `String(error)`, producing `[object Object]`.
  Use `formatBackendError` from `packages/studio/src/shared/utils/backend-error.ts`.
- Hand-writing `invoke('some_command', { some_arg })`. The argument key must be
  camelCase and the command name must not be; the wrapper already knows both.
- Adding a `DataAdapter` method and implementing it in the Tauri adapter only.
- Adding a `Channel` to stream rows. The row path is paged JSON.
- Putting service or driver logic in the command body instead of delegating.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
```

From the repository root:

```bash
bun run --cwd packages/studio typecheck
bun run --cwd apps/desktop typecheck
bun run lint
```

`typecheck` is the gate that catches a binding that does not match its command:
a wrong argument order, a renamed field, or a return type the callers no longer
destructure. Run both, because the two `bindings.ts` copies are typechecked by
different projects.

## Definition of done

- The command is registered in both `apps/desktop/src-tauri/src/lib.rs` and
  `apps/desktop/src-tauri/src/bindings.rs`, and re-exported from its surface
  module's `mod.rs`.
- Every type in the signature derives `specta::Type` and the serde traits its
  direction needs.
- The command returns `Result<T, Error>`, or is provably infallible.
- Any new `Error` variant has a `tag()` arm and reuses an existing tag where the
  meaning already exists.
- The frontend reaches the command through `commands.*` or, when `DataAdapter`
  declares the operation, through `useAdapter()` with both adapters implemented.
- Callers branch on `result.status` and on `error.kind`, not on `error.detail`.
- `packages/studio/src/lib/bindings.ts` declares the command, so the studio can
  see it.
- `cargo test` and both `typecheck` runs pass.

See `reference.md` for the error tag table, the wire-shape catalogue, and the
anatomy of a streaming command.

# AI Implementation Guide (Desktop)

How the AI-powered SQL assistant works in Dora desktop — from database introspection to streaming Groq responses. Adapted from `apps/db-tester/AI-IMPLEMENTATION.md` for the Tauri-native stack.

---

## Architecture Overview

```
User types a question (right-side AI sidebar)
  → useAiChat hook (src/features/ai-assistant/use-ai-chat.ts)
    → packs conversation history into a single prompt string
      → commands.aiCompleteStream(requestId, prompt, connectionId, max, 'chat', channel)
        → Tauri IPC → ai_complete_stream Rust command
          → AIService::complete_stream → GroqClient::complete_stream
            → Groq API (default: llama-3.1-70b-versatile via env/keyring)
              → AiStreamEvent::Token / Final / Error
                → Channel<AiStreamEvent> back to JS
                  → react-markdown renders, code-block exposes Run/Copy/Editor
```

Schema is fetched lazily via the existing `get_database_schema` command when the AI panel opens; it's injected into the system prompt server-side.

Unlike `db-tester` (Next.js, Vercel AI SDK), the desktop app runs everything through Tauri commands. There is no client-side LLM provider library — the Rust process owns the HTTP call to Groq, key management, and abort semantics.

---

## 1. Database Schema Introspection

**Where:** Already implemented for all dora features.

- Rust command: `database::commands::get_database_schema(connection_id)` → returns `DatabaseSchema { tables, schemas, unique_columns }`.
- Tauri binding (TS): `commands.getDatabaseSchema(connectionId)` (`src/lib/bindings.ts`).
- Cached in Rust `AppState::schemas: DashMap<Uuid, Arc<DatabaseSchema>>` on first fetch.

The AI panel reads the schema once per opened connection (no client cache layer — the Rust side already caches it).

**Key files:**
- `src-tauri/src/database/commands/schema.rs` (or wherever `get_database_schema` lives)
- `src-tauri/src/database/contract.rs` — `DatabaseSchema`, `TableInfo`, `ColumnInfo` types

---

## 2. AI Context Construction (Server-Side)

When the AI command is invoked, `database::commands::ai::ai_complete_stream` builds a `SchemaContext` from the cached schema:

```rust
let context = state.schemas.get(&conn_id).map(|schema| {
    let engine = engine_for_connection(&state, conn_id);
    build_schema_context(&schema, &engine)
});
```

`SchemaContext` includes `engine` (`postgres` / `mysql` / `sqlite` / `libsql`), and `Vec<TableContext>` with columns, primary keys, foreign keys, and row estimates.

This context is attached to `AIRequest` along with the user prompt and the new `prompt_mode` selector.

**Key files:**
- `src-tauri/src/database/commands/ai.rs`
- `src-tauri/src/database/services/ai/mod.rs` (`AIRequest`, `SchemaContext`)

---

## 3. Prompt Construction (Server-Side)

**File:** `src-tauri/src/database/services/ai/prompts.rs`

Dispatched by `prompt_mode`:

| `prompt_mode` | Used by | System prompt |
|--------------|---------|---------------|
| `Some("chat")` | AI sidebar (`features/ai-assistant`) | Free-form markdown, ```sql blocks, conversational |
| `None` / other | Cmd+K AI SQL (`features/sql-console/components/ai-cmd-k.tsx`) | Strict JSON `{sql, explanation, warnings}` |

The schema dump (DDL-like listing with PK/FK/NOT NULL annotations) is shared between both modes via `append_schema_block`.

### Chat-mode rules

- Database/SQL questions only
- Wrap SQL in ```sql blocks so the UI can render Run/Copy/Editor buttons
- Concise, dialect-aware
- Warning comments above destructive statements
- Recognise the `USER:` / `ASSISTANT:` packed-conversation shape produced by the client and respond only to the trailing user turn

### API key resolution

1. Keys stored via `aiKeysAdd` (keyring + SQLite metadata, encrypted)
2. Fallback: `GROQ_API_KEY` environment variable (loaded via `dotenvy::dotenv()` on startup)

---

## 4. AI Service Call

`GroqClient::complete_stream` (in `src-tauri/src/database/services/ai/groq.rs`) opens an HTTP stream to the Groq API and forwards token chunks through a `tokio::sync::mpsc::UnboundedSender<AiStreamEvent>`.

- Default model: `llama-3.1-70b-versatile` (Groq)
- Streaming via Groq's SSE endpoint
- Cancellation via shared `Arc<AtomicBool>` keyed by `request_id` in `AppState::ai_cancel_flags`
- The `ai_abort_stream` command flips the flag; the streaming loop checks it between chunks

**Key files:**
- `src-tauri/src/database/services/ai/groq.rs`
- `src-tauri/src/database/services/ai/mod.rs` — `AIService::complete_stream` dispatcher

---

## 5. Streaming Response Rendering

### Client-side

`useAiChat` (`src/features/ai-assistant/use-ai-chat.ts`) drives the loop:

1. Append user message + placeholder assistant message to the Zustand thread
2. Pack history into a single string via `buildChatPrompt`
3. Open a `Channel<AiStreamEvent>` and call `commands.aiCompleteStream(..., 'chat', channel)`
4. On each `{ type: 'token', text }` event, accumulate and call `updateMessage` — Zustand re-renders the bubble
5. On `final` / completion, mark `streaming: false`
6. `abort()` sets a local cancel flag and calls `commands.aiAbortStream(requestId)`

### Rendering pipeline

| File | Role |
|------|------|
| `ai-assistant-panel.tsx` | Sidebar shell, suggestions, input, key/connection status badges |
| `message-bubble.tsx` | User vs assistant styling, streaming cursor, error display |
| `message-content.tsx` | `react-markdown` + `remark-gfm` with custom code renderer |
| `code-block.tsx` | SQL code blocks get Run (`startQuery` + `fetchQuery`), Copy, and Editor buttons |

---

## 6. Dynamic Suggestions

**File:** `src/features/ai-assistant/suggestions.ts`

`buildDynamicSuggestions(tables)` generates 6 context-aware prompts:

- `SELECT * FROM <first_table> LIMIT 10`
- Row count comparison if >1 table
- Insert realistic fake data into a table
- Duplicate detection on a column that looks like `email` (regex fallback)
- Index suggestion on the first varchar/text column
- JOIN query if ≥2 tables

Fallback to 6 generic prompts if no schema is loaded.

Plus 4 quick actions (always visible): **Seed data**, **Schema design**, **Debug SQL error**, **Optimize query**.

---

## 7. State Management

**File:** `src/features/ai-assistant/store.ts` (Zustand + `persist` middleware)

| Field | Purpose |
|-------|---------|
| `open` | AI sidebar visibility |
| `threads` | `Record<connectionId-or-__none__, ChatMessage[]>` persisted to localStorage |
| `pendingPrompt` | Cross-component prompt injection (e.g., from a context menu) |

Schema and Groq-key state are not stored — they're refetched per-open. API keys themselves live in the OS keyring via Rust commands `aiKeysAdd` / `aiKeysList`.

---

## 8. Dependencies

| Package | Purpose |
|---------|---------|
| `react-markdown` + `remark-gfm` | Render AI markdown responses |
| `zustand` | State management with localStorage persistence (already in app) |
| `@tauri-apps/api` | Channel-based streaming IPC (already in app) |
| `lucide-react` | Icons (already in app) |

The Vercel AI SDK is **not** used — Tauri handles streaming end-to-end.

---

## 9. Key Files Summary

| File | Role |
|------|------|
| `src-tauri/src/database/commands/ai.rs` | Tauri commands: `ai_complete`, `ai_complete_stream`, `ai_abort_stream`, key/provider mgmt |
| `src-tauri/src/database/services/ai/mod.rs` | `AIRequest`, `AIService` dispatcher across Groq/Gemini/Ollama |
| `src-tauri/src/database/services/ai/groq.rs` | Streaming Groq HTTP client |
| `src-tauri/src/database/services/ai/prompts.rs` | Mode-dispatched system-prompt builder + shared schema dump |
| `src/features/ai-assistant/ai-assistant-panel.tsx` | Sidebar shell |
| `src/features/ai-assistant/use-ai-chat.ts` | Streaming chat hook |
| `src/features/ai-assistant/build-prompt.ts` | Packs history into one `USER:`/`ASSISTANT:` string |
| `src/features/ai-assistant/message-content.tsx` | Markdown + code-block plumbing |
| `src/features/ai-assistant/code-block.tsx` | Run/Copy/Editor actions on SQL fences |
| `src/features/ai-assistant/suggestions.ts` | Schema-aware suggestion generation |
| `src/features/ai-assistant/store.ts` | Zustand thread store |
| `src/features/sql-console/components/ai-cmd-k.tsx` | Legacy ⌘K SQL flow (JSON mode, untouched logic) |

---

## 10. Differences from `db-tester`

| Concern | db-tester (Next.js) | dora (Tauri) |
|---------|---------------------|--------------|
| LLM transport | Vercel AI SDK + Next API route | Rust HTTP client + Tauri IPC `Channel` |
| API key storage | localStorage override + `GROQ_API_KEY` env | OS keyring via `aiKeysAdd` + env fallback |
| Schema fetch | `POST /api/schema` (introspects PG/MySQL) | Existing `get_database_schema` Tauri command |
| Chat hook | `useChat` from `@ai-sdk/react` | Custom `useAiChat` driving a Tauri `Channel` |
| Conversation shape | `messages: UIMessage[]` sent in body | Single packed prompt with `USER:`/`ASSISTANT:` turns |
| Abort | `req.signal` | Shared `AtomicBool` flag keyed by `request_id` |
| Result rendering | `react-markdown` + custom renderers | Same (re-used) |

The desktop port reuses the entire Rust AI stack that was already in place for the ⌘K SQL flow — only a new prompt mode and a chat UI were added.

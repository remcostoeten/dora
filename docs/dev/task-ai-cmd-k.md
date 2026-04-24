# Task: Schema-Grounded AI ⌘K (natural language → SQL)

**Complexity:** High
**Recommended agent:** Claude Opus 4.7
**Branch:** `feat/ai-cmd-k`
**Estimated time:** 1–2 days
**Cost constraint:** User does not want to pay for AI. Use **Groq (free, rotating API keys)** as primary with **Gemini 2.5 Pro / 3 Flash (free tier)** as secondary. Ollama already wired — keep as local fallback.

---

## Context

Dora already has an AI subsystem scaffolded:

- `apps/desktop/src-tauri/src/database/services/ai/mod.rs` — `AIProvider` enum (`Gemini | Ollama`), `AIService`, `SchemaContext`, `TableContext`, `AIRequest`, `AIResponse`
- `apps/desktop/src-tauri/src/database/services/ai/gemini.rs` — Gemini 2.0 Flash client (139 lines, working)
- `apps/desktop/src-tauri/src/database/services/ai/ollama.rs` — Ollama local client (134 lines, working)
- `apps/desktop/src-tauri/src/database/commands/ai.rs` — Tauri command `ai_complete` with connection-scoped `SchemaContext` injection

**What's missing:**
1. Groq provider (free tier with rotating keys)
2. Frontend UI — no ⌘K hotkey, no prompt input, no streaming result, no "accept/edit/discard" flow
3. Upgrade `SchemaContext` to include column *types*, PK/FK info, sample rows (current one only has column names)
4. Streaming support — current API is request/response, not SSE
5. Structured output — parse `{sql, explanation}` instead of free-text

---

## Prior art / inspiration

These are the benchmark implementations to study before starting:

- **Vercel Natural Language Postgres**
  https://vercel.com/templates/next.js/natural-language-postgres
  — single-file Next.js template, AI SDK streaming, schema prompt injection. Read the system prompt.

- **Supabase database.build** (formerly Postgres Playground)
  https://database.build/
  GitHub: https://github.com/supabase-community/database-build
  Blog (v2): https://supabase.com/blog/database-build-v2
  — full in-browser pglite + AI-driven schema design. Read `apps/postgres-new/lib/tools/` for the tool-calling pattern: the LLM calls `executeSql`, `generateEmbedding`, etc. as tools. This is **better than free-text generation** because the model gets to iterate based on query results.

**Takeaways to copy:**
1. Tool-calling beats free-text generation — give the LLM a `run_sql` tool, let it explore the schema before writing the final query
2. System prompt should include: PG version, table list with column types, a few sample rows per table, any INDEX + FK info
3. Stream tokens — users see output incrementally
4. Parse structured output: `{sql: string, explanation: string, warnings?: string[]}`

---

## Part 1 — Backend (Rust)

### 1a. Add Groq provider

**New file:** `apps/desktop/src-tauri/src/database/services/ai/groq.rs`

Groq API is OpenAI-compatible. Model picks:
- `llama-3.3-70b-versatile` — default, best for SQL
- `llama-3.1-8b-instant` — faster fallback
- `mixtral-8x7b-32768` — long context

Endpoint: `https://api.groq.com/openai/v1/chat/completions`

### 1b. Rotating key support

Groq free tier has rate limits per key. Read multiple keys from env:
```
GROQ_API_KEY_1=gsk_...
GROQ_API_KEY_2=gsk_...
GROQ_API_KEY_3=gsk_...
```

Implement key rotation in `groq.rs`:

```rust
pub struct GroqClient {
    keys: Vec<String>,
    counter: std::sync::atomic::AtomicUsize,
    model: String,
}

impl GroqClient {
    pub fn from_env() -> Result<Self, Error> {
        let mut keys = Vec::new();
        // read GROQ_API_KEY and GROQ_API_KEY_1..N
        if let Ok(k) = std::env::var("GROQ_API_KEY") { keys.push(k); }
        for i in 1..=10 {
            if let Ok(k) = std::env::var(format!("GROQ_API_KEY_{}", i)) {
                keys.push(k);
            }
        }
        if keys.is_empty() {
            return Err(Error::InvalidInput("No GROQ_API_KEY_* env vars found".into()));
        }
        Ok(Self { keys, counter: Default::default(), model: "llama-3.3-70b-versatile".into() })
    }

    fn next_key(&self) -> &str {
        let idx = self.counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        &self.keys[idx % self.keys.len()]
    }
}
```

On 429 rate-limit response: increment counter, retry once with next key. Cap retries at `keys.len()`.

### 1c. Update `AIProvider` enum

```rust
pub enum AIProvider {
    Groq,     // default
    Gemini,
    Ollama,
}

impl Default for AIProvider {
    fn default() -> Self { Self::Groq }
}
```

Update `AIService::complete()` match arm. Update `ai_set_provider` command to accept `"groq"`.

### 1d. Rich `SchemaContext`

Current (too thin):
```rust
pub struct TableContext {
    pub name: String,
    pub columns: Vec<String>,
}
```

Replace with:
```rust
pub struct TableContext {
    pub name: String,
    pub schema: String,
    pub columns: Vec<ColumnContext>,
    pub primary_keys: Vec<String>,
    pub foreign_keys: Vec<ForeignKeyContext>,
    pub row_count_estimate: Option<u64>,
    pub sample_rows: Option<Vec<serde_json::Value>>, // up to 3, opt-in
}

pub struct ColumnContext {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_unique: bool,
}

pub struct ForeignKeyContext {
    pub column: String,
    pub referenced_table: String,
    pub referenced_column: String,
}
```

Build from `DatabaseSchema` (already have all this data — see `src/database/types.rs`). Add opt-in `include_sample_rows: bool` param to avoid pulling data for huge tables.

### 1e. Streaming + structured output

Add new command `ai_complete_stream` that returns a channel:

```rust
#[tauri::command]
#[specta::specta]
pub async fn ai_complete_stream(
    prompt: String,
    connection_id: Option<Uuid>,
    include_sample_rows: bool,
    state: State<'_, AppState>,
    on_event: tauri::ipc::Channel<AiStreamEvent>,
) -> Result<(), Error>
```

Events:
```rust
#[derive(Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiStreamEvent {
    Token { text: String },
    SqlDelta { sql: String },              // incremental SQL as it's written
    ExplanationDelta { text: String },
    Final { sql: String, explanation: String, warnings: Vec<String> },
    Error { message: String },
}
```

Groq supports SSE streaming — set `stream: true` in request body, parse `data: ` lines. Use `reqwest::Response::bytes_stream()` + `tokio::stream`.

### 1f. System prompt template

Store in `src/database/services/ai/prompts.rs`:

```rust
pub fn build_system_prompt(engine: &str, ctx: &SchemaContext) -> String {
    // Structure:
    // 1. Role: "You are an expert SQL analyst for <engine>"
    // 2. Output format: JSON { sql, explanation, warnings }
    // 3. Rules: "Never DROP/TRUNCATE. Use LIMIT 100 on SELECT. Use schema-qualified names."
    // 4. Schema dump: tables + columns + types + FKs
    // 5. Sample rows (if available)
    // 6. Examples: 3 few-shot "user: ... → json: ..." pairs
}
```

Keep system prompt under ~6000 tokens. Truncate schema context to largest N tables if oversized.

---

## Part 2 — Frontend (React)

### 2a. Settings page entry

Add to existing settings panel (check `src/features/sidebar/components/settings-panel.tsx` for pattern):
- Provider dropdown: Groq (free) / Gemini / Ollama (local)
- Env var status indicator: "3 Groq keys detected" or "No GROQ_API_KEY env vars — set in system"
- For Gemini/Ollama: existing API key / endpoint inputs (already wired — don't touch)

**Do NOT store Groq keys in app storage.** They come from env only. That's the whole point of rotating free-tier keys.

### 2b. ⌘K inline AI component

**New file:** `src/features/sql-console/components/ai-cmd-k.tsx`

Triggered from inside SQL editor. When active:
- Overlay at cursor position (fixed, bottom-anchored)
- Input: textarea for natural language prompt
- Status: "Generating... (via Groq)" with model name
- Streaming output: live SQL in a readonly mini-Monaco below the input
- Keybindings while open: `Enter` = accept & insert into editor, `⌘Enter` = accept + execute, `Esc` = cancel, `⌘R` = regenerate

### 2c. Shortcut registration

In `src/core/shortcuts/shortcuts.ts` add:
```ts
aiCmdK: { combo: 'mod+k', description: 'AI: generate SQL from prompt', scope: 'sql-console' }
```

Bind in `sql-console.tsx` via `useActiveScope($, 'sql-console')`.

### 2d. Stream consumer

Use Tauri `Channel`:
```ts
import { Channel } from '@tauri-apps/api/core'
import { commands } from '@/lib/bindings'

const channel = new Channel<AiStreamEvent>()
channel.onmessage = (event) => {
  switch (event.type) {
    case 'sql_delta':
      setSqlPreview(prev => prev + event.sql)
      break
    case 'final':
      setFinalSql(event.sql)
      setExplanation(event.explanation)
      break
    case 'error':
      setError(event.message)
      break
  }
}

await commands.aiCompleteStream(prompt, connectionId, false, channel)
```

### 2e. Accept flow

On Enter:
1. Replace current selection (or insert at cursor) with generated SQL
2. Show a toast with the explanation
3. Auto-open a "warnings" strip if the response included any

### 2f. Tool-calling (phase 2 — optional but high-impact)

The database.build killer feature: let the LLM call `run_sql` to inspect the DB before answering.

Add a `run_sql` tool to the Groq request. When model emits a tool call:
1. Run the SQL (read-only — block DELETE/UPDATE/INSERT/DROP at tauri layer)
2. Send result back as tool response
3. Model continues with more context

Gates SQL to read-only via regex / sqlparser before execution. This is the difference between "AI that guesses" and "AI that understands your data."

---

## File list

| File | Action |
|------|--------|
| `src-tauri/src/database/services/ai/groq.rs` | New — Groq client with rotating keys |
| `src-tauri/src/database/services/ai/prompts.rs` | New — system prompt builder |
| `src-tauri/src/database/services/ai/mod.rs` | Add `Groq` variant, expose `GroqClient` |
| `src-tauri/src/database/commands/ai.rs` | Add `ai_complete_stream` command |
| `src-tauri/src/database/metadata.rs` | Add `sample_rows_for_tables` helper (read-only, LIMIT 3) |
| `src/features/sql-console/components/ai-cmd-k.tsx` | New — inline AI overlay |
| `src/features/sql-console/components/sql-editor.tsx` | Wire ⌘K trigger |
| `src/features/sql-console/sql-console.tsx` | Mount `<AiCmdK>` |
| `src/core/shortcuts/shortcuts.ts` | Add `aiCmdK` shortcut |
| `src/features/sidebar/components/settings-panel.tsx` | Add Groq provider option + env key status |

## TypeScript / Cargo checks

```bash
cd apps/desktop
~/.bun/bin/bun x tsc --noEmit -p tsconfig.app.json  # exit 0
cd src-tauri && cargo check                          # exit 0
cargo clippy -- -D warnings                          # exit 0
```

## Done when

- `GROQ_API_KEY_1`/`_2`/`_3` set in env → Groq provider available
- ⌘K in SQL console → overlay opens → type "users who signed up last week" → SQL streams in → Enter inserts
- 429 from Groq → transparent rotation to next key, no user-visible error
- Schema context includes types + FKs + PKs
- No API keys stored in app (env only for Groq; existing storage for Gemini/Ollama)
- Falls back to Gemini / Ollama per user setting if selected explicitly
- Tool-calling (phase 2) enabled behind a settings toggle

## Constraints

- No paid API commitments — Groq free tier + Gemini free tier + Ollama local only
- Never expose API keys to frontend — all LLM calls via Tauri commands
- Rate-limit errors must rotate keys transparently, not fail the request
- Tool-calling `run_sql` MUST be read-only enforced at the Tauri command boundary (use sqlparser to reject non-SELECT)

use super::AIRequest;

const MAX_TABLES_IN_PROMPT: usize = 60;
const MAX_COLUMNS_PER_TABLE: usize = 40;
const MAX_INDEXES_PER_TABLE: usize = 20;

/// Build (system_prompt, user_prompt) pair. Dispatches on `request.prompt_mode`:
/// - `Some("chat")` → free-form markdown assistant (used by the chat sidebar).
/// - Anything else → legacy JSON-only SQL generation (used by ⌘K SQL flow).
pub fn build(request: &AIRequest) -> (String, String) {
    let system = match request.prompt_mode.as_deref() {
        Some("chat") => build_chat_system_prompt(request),
        _ => build_system_prompt(request),
    };
    let user = request.prompt.clone();
    (system, user)
}

fn build_chat_system_prompt(request: &AIRequest) -> String {
    let engine = request
        .context
        .as_ref()
        .map(|c| c.engine.as_str())
        .unwrap_or("sql");

    let mut s = String::new();

    s.push_str(&format!(
        "You are a senior database engineer embedded in Dora, a SQL database management tool. The user is working with a {engine} database.\n\n"
    ));

    s.push_str("## How to answer\n");
    s.push_str("- Ground every recommendation in the schema below (tables, columns, foreign keys, indexes, row counts). Do not invent objects.\n");
    s.push_str("- For schema review or efficiency questions: start with a short verdict, then separate **already good**, **worth investigating**, and **probably skip**.\n");
    s.push_str("- Before suggesting a new index, check whether an existing index or unique/PK constraint already covers the same column(s). If it does, say so and do not recommend a duplicate.\n");
    s.push_str("- Before suggesting partitioning, message queues, caching layers, or major remodels, explain why simpler fixes (indexes, query shape, EXPLAIN) are insufficient. Do not treat ~1M rows as automatically large for Postgres.\n");
    s.push_str("- Do not recommend removing useful denormalization (e.g. cached `last_message`, summary columns) unless you explain the read-path cost.\n");
    s.push_str("- JSONB/key-value settings tables and simple text columns (e.g. colors) are usually fine; avoid over-normalization unless the user filters or reports on those values often.\n");
    s.push_str("- Small tables (well under a few thousand rows) rarely need new indexes for FK columns unless a slow query is proven.\n");
    s.push_str("- For performance questions, prefer diagnostic SQL (`EXPLAIN`, `EXPLAIN ANALYZE`, index usage views) before DDL. Say when you are inferring vs when the schema proves something.\n");
    s.push_str("- If context is incomplete (missing indexes, truncated tables, no query plan), say what you cannot verify and ask one focused follow-up.\n");
    s.push_str("- Wrap executable SQL in ```sql code blocks so the UI can render Run/Copy buttons.\n");
    s.push_str("- Use realistic fake values when writing INSERT examples.\n");
    s.push_str("- Default to the active database dialect. Note dialect-specific syntax when relevant.\n");
    s.push_str("- For fuzzy text matching, explain that plain `LIKE`/`ILIKE` does not return a match percentage. For PostgreSQL, mention `pg_trgm` (`similarity`, `%`, GIN indexes) or full-text search when substring search is the bottleneck.\n");
    s.push_str("- For destructive statements (DELETE/UPDATE without WHERE, DROP, TRUNCATE) add a one-line warning comment above the SQL.\n");
    s.push_str("- If the user prompt includes `Current Dora UI context`, use it for references like \"this table\" or \"selected table\".\n");
    s.push_str("- The user's message may contain prior turns formatted as `USER:` / `ASSISTANT:`. Treat them as conversation history and answer only the final user turn.\n\n");

    append_schema_block(&mut s, request);

    s
}

fn build_system_prompt(request: &AIRequest) -> String {
    let engine = request
        .context
        .as_ref()
        .map(|c| c.engine.as_str())
        .unwrap_or("sql");

    let mut s = String::new();

    s.push_str(&format!(
        "You are an expert {engine} analyst. Convert the user's natural-language request into a single, correct SQL query against the database schema below.\n\n"
    ));

    s.push_str("## Output format\n");
    s.push_str(
        "Respond with ONLY a JSON object. No markdown, no code fences, no prose outside the JSON:\n\
         {\"sql\":\"<the sql query>\",\"explanation\":\"<one-sentence explanation>\",\"warnings\":[\"<optional safety concern>\"]}\n\n",
    );

    s.push_str("## Rules\n");
    s.push_str("- Produce ONE statement. No semicolon-separated batches.\n");
    s.push_str("- Default to SELECT. NEVER emit DROP, TRUNCATE, DELETE without WHERE, or UPDATE without WHERE.\n");
    s.push_str("- Add LIMIT 100 to unbounded SELECTs unless the user asks for an aggregate.\n");
    s.push_str(
        "- Use exact column and table names from the schema below. Do not invent columns.\n",
    );
    s.push_str("- Use schema-qualified names where a non-default schema is present.\n");
    s.push_str("- Prefer explicit JOINs with ON clauses over comma joins.\n");
    s.push_str("- If the request is ambiguous, pick the most useful interpretation and note the assumption in `explanation`.\n");
    s.push_str(
        "- If destructive intent is detected, populate `warnings` but still emit the query.\n\n",
    );

    append_schema_block(&mut s, request);

    s.push_str("\n## Examples\n");
    s.push_str("User: count rows in users\n");
    s.push_str("Response: {\"sql\":\"SELECT COUNT(*) FROM users\",\"explanation\":\"Total rows in users table.\",\"warnings\":[]}\n\n");
    s.push_str("User: users who never logged in\n");
    s.push_str("Response: {\"sql\":\"SELECT * FROM users WHERE last_login_at IS NULL LIMIT 100\",\"explanation\":\"Users whose last_login_at is null.\",\"warnings\":[]}\n\n");
    s.push_str("User: delete all users\n");
    s.push_str("Response: {\"sql\":\"DELETE FROM users WHERE 1=0\",\"explanation\":\"Refusing to delete all rows. Use WHERE id IN (...) instead.\",\"warnings\":[\"Request was destructive; returned a no-op DELETE.\"]}\n");

    s
}

fn append_schema_block(s: &mut String, request: &AIRequest) {
    if let Some(ctx) = &request.context {
        s.push_str("## Database schema\n");
        s.push_str(
            "Use this as the source of truth. Indexes listed here already exist — do not recreate them.\n",
        );

        let tables: Vec<_> = ctx.tables.iter().take(MAX_TABLES_IN_PROMPT).collect();
        for table in &tables {
            let qualified = if table.schema.is_empty() || table.schema == "public" {
                table.name.clone()
            } else {
                format!("{}.{}", table.schema, table.name)
            };

            s.push_str(&format!("\n### {}", qualified));
            if let Some(rows) = table.row_count_estimate {
                s.push_str(&format!(" (~{} rows)", rows));
            }
            s.push('\n');

            if !table.primary_keys.is_empty() {
                s.push_str(&format!(
                    "  Primary key: {}\n",
                    table.primary_keys.join(", ")
                ));
            }

            for column in table.columns.iter().take(MAX_COLUMNS_PER_TABLE) {
                let mut annots = Vec::new();
                if column.is_primary_key {
                    annots.push("PK");
                }
                if column.is_auto_increment {
                    annots.push("AUTO");
                }
                if !column.is_nullable {
                    annots.push("NOT NULL");
                }
                let annot_str = if annots.is_empty() {
                    String::new()
                } else {
                    format!(" [{}]", annots.join(","))
                };
                s.push_str(&format!(
                    "  - {} {}{}\n",
                    column.name, column.data_type, annot_str
                ));
            }

            if table.columns.len() > MAX_COLUMNS_PER_TABLE {
                s.push_str(&format!(
                    "  ... {} more columns truncated\n",
                    table.columns.len() - MAX_COLUMNS_PER_TABLE
                ));
            }

            if !table.foreign_keys.is_empty() {
                s.push_str("  Foreign keys:\n");
                for fk in &table.foreign_keys {
                    let target =
                        if fk.referenced_schema.is_empty() || fk.referenced_schema == "public" {
                            fk.referenced_table.clone()
                        } else {
                            format!("{}.{}", fk.referenced_schema, fk.referenced_table)
                        };
                    s.push_str(&format!(
                        "  - {} -> {}.{}\n",
                        fk.column, target, fk.referenced_column
                    ));
                }
            }

            if !table.indexes.is_empty() {
                s.push_str("  Indexes:\n");
                for index in table.indexes.iter().take(MAX_INDEXES_PER_TABLE) {
                    let mut flags = Vec::new();
                    if index.is_primary {
                        flags.push("PK");
                    }
                    if index.is_unique {
                        flags.push("UNIQUE");
                    }
                    let flag_str = if flags.is_empty() {
                        String::new()
                    } else {
                        format!(" [{}]", flags.join(","))
                    };
                    s.push_str(&format!(
                        "  - {}{}: ({})\n",
                        index.name,
                        flag_str,
                        index.column_names.join(", ")
                    ));
                }
                if table.indexes.len() > MAX_INDEXES_PER_TABLE {
                    s.push_str(&format!(
                        "  ... {} more indexes truncated\n",
                        table.indexes.len() - MAX_INDEXES_PER_TABLE
                    ));
                }
            }
        }

        if ctx.tables.len() > MAX_TABLES_IN_PROMPT {
            s.push_str(&format!(
                "\n... {} more tables truncated from context\n",
                ctx.tables.len() - MAX_TABLES_IN_PROMPT
            ));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::services::ai::{
        AIRequest, ColumnContext, ForeignKeyContext, IndexContext, SchemaContext, TableContext,
    };

    #[test]
    fn chat_prompt_includes_indexes_and_review_guidance() {
        let request = AIRequest {
            prompt: "Is my schema efficient?".into(),
            context: Some(SchemaContext {
                engine: "postgres".into(),
                tables: vec![TableContext {
                    name: "reading_progress".into(),
                    schema: "public".into(),
                    columns: vec![ColumnContext {
                        name: "chat_id".into(),
                        data_type: "uuid".into(),
                        is_nullable: false,
                        is_primary_key: false,
                        is_auto_increment: false,
                    }],
                    primary_keys: vec!["id".into()],
                    foreign_keys: vec![ForeignKeyContext {
                        column: "chat_id".into(),
                        referenced_table: "chats".into(),
                        referenced_column: "id".into(),
                        referenced_schema: "public".into(),
                    }],
                    indexes: vec![IndexContext {
                        name: "reading_progress_chat_id_key".into(),
                        column_names: vec!["chat_id".into()],
                        is_unique: true,
                        is_primary: false,
                    }],
                    row_count_estimate: Some(120),
                }],
            }),
            connection_id: None,
            max_tokens: None,
            prompt_mode: Some("chat".into()),
        };

        let (system, _) = build(&request);
        assert!(system.contains("Indexes listed here already exist"));
        assert!(system.contains("reading_progress_chat_id_key"));
        assert!(system.contains("do not recommend a duplicate"));
    }
}

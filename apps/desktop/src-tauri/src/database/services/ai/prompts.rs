use super::AIRequest;

const MAX_TABLES_IN_PROMPT: usize = 60;
const MAX_COLUMNS_PER_TABLE: usize = 40;

/// Build (system_prompt, user_prompt) pair for a schema-grounded SQL generation request.
pub fn build(request: &AIRequest) -> (String, String) {
    let system = build_system_prompt(request);
    let user = request.prompt.clone();
    (system, user)
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

    if let Some(ctx) = &request.context {
        s.push_str("## Database schema\n");

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
        }

        if ctx.tables.len() > MAX_TABLES_IN_PROMPT {
            s.push_str(&format!(
                "\n... {} more tables truncated from context\n",
                ctx.tables.len() - MAX_TABLES_IN_PROMPT
            ));
        }
    }

    s.push_str("\n## Examples\n");
    s.push_str("User: count rows in users\n");
    s.push_str("Response: {\"sql\":\"SELECT COUNT(*) FROM users\",\"explanation\":\"Total rows in users table.\",\"warnings\":[]}\n\n");
    s.push_str("User: users who never logged in\n");
    s.push_str("Response: {\"sql\":\"SELECT * FROM users WHERE last_login_at IS NULL LIMIT 100\",\"explanation\":\"Users whose last_login_at is null.\",\"warnings\":[]}\n\n");
    s.push_str("User: delete all users\n");
    s.push_str("Response: {\"sql\":\"DELETE FROM users WHERE 1=0\",\"explanation\":\"Refusing to delete all rows. Use WHERE id IN (...) instead.\",\"warnings\":[\"Request was destructive; returned a no-op DELETE.\"]}\n");

    s
}

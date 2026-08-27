use std::collections::{HashMap, HashSet};

use anyhow::Context;
use tokio_postgres::Client;

use crate::{
    database::{
        dialect::PgDialect,
        types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo},
    },
    Error,
};

/// Introspect the schema for a Postgres-wire connection.
///
/// The catalog query strings come from `dialect.introspection()`: vanilla
/// Postgres uses the canonical queries, while CockroachDB overrides only the
/// queries whose vanilla form fails or returns wrong/empty results against a
/// live cluster (see `PgIntrospection::COCKROACH`). The vanilla path is
/// byte-for-byte identical to the previous inline queries.
pub async fn get_database_schema(
    client: &Client,
    dialect: PgDialect,
) -> Result<DatabaseSchema, Error> {
    let queries = dialect.introspection();

    // All five catalog queries are dispatched concurrently: tokio-postgres
    // pipelines statements on one connection when their futures are polled
    // together, so a remote database pays roughly one round trip instead of
    // five. `value_constraints` stays best-effort (restricted catalog access
    // must not sink the whole introspection), so its error is captured rather
    // than propagated.
    let (rows, fk_rows, index_rows, count_rows, constraint_result) = tokio::try_join!(
        client.query(queries.tables_columns, &[]),
        client.query(queries.foreign_keys, &[]),
        client.query(queries.indexes, &[]),
        client.query(queries.row_counts, &[]),
        async { Ok(client.query(queries.value_constraints, &[]).await) },
    )
    .context("Failed to query database schema")?;

    // Build foreign key lookup: (schema, table, column) -> ForeignKeyInfo
    let mut fk_map: HashMap<(String, String, String), ForeignKeyInfo> = HashMap::new();
    for row in &fk_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let column: &str = row.get(2);
        let ref_schema: &str = row.get(3);
        let ref_table: &str = row.get(4);
        let ref_column: &str = row.get(5);

        fk_map.insert(
            (schema.to_owned(), table.to_owned(), column.to_owned()),
            ForeignKeyInfo {
                referenced_schema: ref_schema.to_owned(),
                referenced_table: ref_table.to_owned(),
                referenced_column: ref_column.to_owned(),
            },
        );
    }

    let mut index_map: HashMap<(String, String), Vec<IndexInfo>> = HashMap::new();
    for row in &index_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let index_name: &str = row.get(2);
        let index_def: &str = row.get(3);

        // Simple parsing of index definition to extract columns and uniqueness
        // Example: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
        let is_unique = index_def.to_uppercase().contains("UNIQUE INDEX");
        let is_primary = index_name.ends_with("_pkey"); // simplistic check, but widely applicable

        let columns_part = index_def
            .split("USING")
            .nth(1)
            .unwrap_or("")
            .split("(")
            .nth(1)
            .unwrap_or("")
            .split(")")
            .next()
            .unwrap_or("");

        let column_names: Vec<String> = columns_part
            .split(',')
            .map(|s| strip_index_column_direction(s.trim()).to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let index_info = IndexInfo {
            name: index_name.to_owned(),
            column_names,
            is_unique,
            is_primary,
        };

        index_map
            .entry((schema.to_owned(), table.to_owned()))
            .or_default()
            .push(index_info);
    }

    // Build row count lookup. A negative estimate (`reltuples = -1`, never
    // analyzed) means "unknown": leave the table out so it surfaces as `None`
    // and the background exact count fills it in.
    let mut count_map: HashMap<(String, String), u64> = HashMap::new();
    for row in &count_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let count: i64 = row.get(2);
        if count >= 0 {
            count_map.insert((schema.to_owned(), table.to_owned()), count as u64);
        }
    }

    // Query for closed value sets (enum labels + single-column CHECK lists).
    // Best-effort: a failure here (e.g. restricted catalog access) must not sink
    // the whole introspection, so we log and continue with an empty map.
    let mut allowed_map: HashMap<(String, String, String), Vec<String>> = HashMap::new();
    match constraint_result {
        Ok(constraint_rows) => {
            for row in &constraint_rows {
                let schema: &str = row.get(0);
                let table: &str = row.get(1);
                let column: &str = row.get(2);
                let kind: &str = row.get(3);
                let payload: &str = row.get(4);

                let values = match kind {
                    "enum" => vec![payload.to_owned()],
                    "check" => match parse_check_allowed_values(payload) {
                        Some(parsed) => parsed,
                        None => continue,
                    },
                    _ => continue,
                };

                let entry = allowed_map
                    .entry((schema.to_owned(), table.to_owned(), column.to_owned()))
                    .or_default();
                for value in values {
                    if !entry.contains(&value) {
                        entry.push(value);
                    }
                }
            }
        }
        Err(err) => {
            log::debug!("Failed to query value constraints: {}", err);
        }
    }

    // Key is (schema, table_name)
    let mut tables_map: HashMap<(&str, &str), TableInfo> = HashMap::new();
    let mut schemas_set = HashSet::new();
    let mut unique_columns_set = HashSet::new();

    for row in &rows {
        let schema: &str = row.get(0);
        let table_name: &str = row.get(1);
        let column_name: &str = row.get(2);
        let data_type: &str = row.get(3);
        let is_nullable: bool = row.get(4);
        let default_value: Option<&str> = row.get(5);
        let is_primary_key: bool = row.get(6);
        let is_auto_increment: bool = row.get(7);

        schemas_set.insert(schema);
        unique_columns_set.insert(column_name);

        let table_key = (schema, table_name);

        let table_info = tables_map.entry(table_key).or_insert_with(|| {
            let row_count = count_map
                .get(&(schema.to_owned(), table_name.to_owned()))
                .copied();

            let indexes = index_map
                .remove(&(schema.to_owned(), table_name.to_owned()))
                .unwrap_or_default();

            TableInfo {
                name: table_name.to_owned(),
                schema: schema.to_owned(),
                columns: Vec::new(),
                primary_key_columns: Vec::new(),
                row_count_estimate: row_count,
                indexes,
            }
        });

        // Track primary key columns at table level
        if is_primary_key {
            let col_name = column_name.to_owned();
            if !table_info.primary_key_columns.contains(&col_name) {
                table_info.primary_key_columns.push(col_name);
            }
        }

        // Look up foreign key info
        let foreign_key = fk_map
            .get(&(
                schema.to_owned(),
                table_name.to_owned(),
                column_name.to_owned(),
            ))
            .cloned();

        let allowed_values = allowed_map.get(&(
            schema.to_owned(),
            table_name.to_owned(),
            column_name.to_owned(),
        ));

        table_info.columns.push(ColumnInfo {
            name: column_name.to_owned(),
            data_type: data_type.to_owned(),
            is_nullable,
            default_value: default_value.map(|s| s.to_owned()),
            is_primary_key,
            is_auto_increment,
            foreign_key,
            allowed_values: allowed_values.cloned(),
        });
    }

    let tables = tables_map.into_values().collect();
    let schemas = schemas_set.into_iter().map(ToOwned::to_owned).collect();
    let unique_columns = unique_columns_set
        .into_iter()
        .map(ToOwned::to_owned)
        .collect();

    Ok(DatabaseSchema {
        tables,
        schemas,
        unique_columns,
    })
}

/// Extract the allowed-value list from a single-column `CHECK` constraint
/// definition as returned by `pg_get_constraintdef`.
///
/// Postgres normalizes `col IN ('a', 'b')` to
/// `CHECK ((col = ANY (ARRAY['a'::text, 'b'::text])))`, so we accept both the
/// `= ANY (ARRAY[...])` and the literal `IN (...)` forms. Only those membership
/// forms are treated as allow-lists; any other predicate (e.g. a range check or
/// a `<>` exclusion) returns `None` so it is never mistaken for a value set.
///
/// Within a recognized form every single-quoted SQL literal is a member; the
/// surrounding `::type` casts are ignored because only the quoted text is read.
/// Embedded quotes use SQL's doubled-quote escaping (`''`).
fn parse_check_allowed_values(def: &str) -> Option<Vec<String>> {
    let upper = def.to_uppercase();
    let is_membership =
        (upper.contains("= ANY") && upper.contains("ARRAY[")) || upper.contains(" IN (");
    if !is_membership {
        return None;
    }

    let mut values = Vec::new();
    let chars: Vec<char> = def.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '\'' {
            i += 1;
            continue;
        }
        // Opening quote: consume until the closing quote, treating `''` as an
        // escaped single quote rather than a terminator.
        i += 1;
        let mut literal = String::new();
        while i < chars.len() {
            if chars[i] == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    literal.push('\'');
                    i += 2;
                    continue;
                }
                i += 1;
                break;
            }
            literal.push(chars[i]);
            i += 1;
        }
        if !values.contains(&literal) {
            values.push(literal);
        }
    }

    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

/// Strip a trailing sort-direction token from an index column reference.
///
/// Vanilla Postgres' `pg_get_indexdef` emits a direction only for non-default
/// ordering (e.g. `email DESC`), so plain ascending columns arrive bare
/// (`email`). CockroachDB instead appends an explicit ` ASC` to *every* indexed
/// column (`email ASC`), which would otherwise be captured as part of the column
/// name. Stripping a trailing ` ASC`/` DESC` normalizes both: it is a no-op for
/// vanilla ascending columns (no trailing token) and recovers the bare name for
/// CockroachDB. A genuine `DESC` ordering loses only its direction marker, which
/// the column-name list does not carry anyway.
fn strip_index_column_direction(column: &str) -> &str {
    for suffix in [" ASC", " DESC", " asc", " desc"] {
        if let Some(stripped) = column.strip_suffix(suffix) {
            return stripped.trim_end();
        }
    }
    column
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::dialect::PgIntrospection;

    #[test]
    fn strips_cockroach_asc_direction() {
        assert_eq!(strip_index_column_direction("id ASC"), "id");
        assert_eq!(strip_index_column_direction("email ASC"), "email");
    }

    #[test]
    fn strips_desc_direction() {
        assert_eq!(strip_index_column_direction("created DESC"), "created");
    }

    #[test]
    fn parses_normalized_any_array_check() {
        // The form Postgres rewrites `variant IN (...)` into.
        let def = "CHECK ((variant = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'danger'::text])))";
        assert_eq!(
            parse_check_allowed_values(def),
            Some(vec![
                "info".to_string(),
                "success".to_string(),
                "warning".to_string(),
                "danger".to_string(),
            ])
        );
    }

    #[test]
    fn parses_varchar_cast_any_array_check() {
        let def = "CHECK (((status)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[])))";
        assert_eq!(
            parse_check_allowed_values(def),
            Some(vec!["a".to_string(), "b".to_string()])
        );
    }

    #[test]
    fn parses_literal_in_list_check() {
        let def = "CHECK ((kind IN ('x'::text, 'y'::text)))";
        assert_eq!(
            parse_check_allowed_values(def),
            Some(vec!["x".to_string(), "y".to_string()])
        );
    }

    #[test]
    fn handles_doubled_quote_escaping() {
        let def = "CHECK ((label = ANY (ARRAY['it''s'::text, 'ok'::text])))";
        assert_eq!(
            parse_check_allowed_values(def),
            Some(vec!["it's".to_string(), "ok".to_string()])
        );
    }

    #[test]
    fn ignores_non_membership_checks() {
        // Range and exclusion predicates are not allow-lists.
        assert_eq!(parse_check_allowed_values("CHECK ((age >= 0))"), None);
        assert_eq!(
            parse_check_allowed_values("CHECK ((status <> 'deleted'::text))"),
            None
        );
    }

    #[test]
    fn leaves_bare_vanilla_column_untouched() {
        // Vanilla ascending columns arrive with no trailing direction token.
        assert_eq!(strip_index_column_direction("email"), "email");
        assert_eq!(strip_index_column_direction("lower(email)"), "lower(email)");
    }

    #[test]
    fn vanilla_and_cockroach_share_unchanged_queries() {
        // Tables/columns and FK queries are not overridden for CockroachDB, so
        // they must be the same pointers/strings the vanilla path uses.
        let v = PgIntrospection::VANILLA;
        let c = PgIntrospection::COCKROACH;
        assert_eq!(v.tables_columns, c.tables_columns);
        assert_eq!(v.foreign_keys, c.foreign_keys);
        assert_eq!(v.indexes, c.indexes);
        // Only row counts diverge: vanilla reads the restart-surviving
        // pg_class.reltuples, CockroachDB its own statistics table.
        assert_ne!(v.row_counts, c.row_counts);
        assert!(v.row_counts.contains("reltuples"));
        assert!(!v.row_counts.contains("pg_stat_user_tables"));
        assert!(c.row_counts.contains("crdb_internal.table_row_statistics"));
    }
}

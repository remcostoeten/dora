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

    // Main columns query with primary key detection
    let rows = client
        .query(queries.tables_columns, &[])
        .await
        .context("Failed to query database schema")?;

    // Query for foreign keys
    let fk_rows = client
        .query(queries.foreign_keys, &[])
        .await
        .context("Failed to query foreign keys")?;

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

    // Query for indexes
    let index_rows = client
        .query(queries.indexes, &[])
        .await
        .context("Failed to query indexes")?;

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

    // Query for row count estimates (fast; vanilla uses pg_stat_user_tables,
    // CockroachDB uses crdb_internal.table_row_statistics — see PgIntrospection).
    let count_rows = client
        .query(queries.row_counts, &[])
        .await
        .context("Failed to query row counts")?;

    // Build row count lookup
    let mut count_map: HashMap<(String, String), u64> = HashMap::new();
    for row in &count_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let count: i64 = row.get(2);
        count_map.insert((schema.to_owned(), table.to_owned()), count as u64);
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

        table_info.columns.push(ColumnInfo {
            name: column_name.to_owned(),
            data_type: data_type.to_owned(),
            is_nullable,
            default_value: default_value.map(|s| s.to_owned()),
            is_primary_key,
            is_auto_increment,
            foreign_key,
        });
    }

    for table in tables_map.values_mut() {
        if table.row_count_estimate.unwrap_or(0) != 0 {
            continue;
        }

        match exact_row_count(client, &table.schema, &table.name).await {
            Ok(count) => table.row_count_estimate = Some(count),
            Err(err) => {
                log::debug!(
                    "Failed to get exact row count for {}.{}: {}",
                    table.schema,
                    table.name,
                    err
                );
            }
        }
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

async fn exact_row_count(client: &Client, schema: &str, table: &str) -> Result<u64, Error> {
    let query = format!(
        "SELECT COUNT(*)::text AS count FROM {}.{}",
        quote_identifier(schema),
        quote_identifier(table)
    );

    let rows = client
        .simple_query(&query)
        .await
        .context("Failed to query exact row count")?;

    for message in rows {
        if let tokio_postgres::SimpleQueryMessage::Row(row) = message {
            let count = row
                .try_get("count")?
                .unwrap_or("0")
                .parse::<u64>()
                .context("Failed to parse exact row count")?;
            return Ok(count);
        }
    }

    Ok(0)
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
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
        // Only row counts diverge.
        assert_ne!(v.row_counts, c.row_counts);
        assert!(c.row_counts.contains("crdb_internal.table_row_statistics"));
    }
}

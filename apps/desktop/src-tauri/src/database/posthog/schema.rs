//! PostHog HogQL schema introspection over HTTP.
//!
//! PostHog has no `information_schema` to query; its HogQL surface exposes a
//! fixed set of top-level virtual tables. We list that curated set and derive
//! each table's columns by asking HogQL to reflect a zero-row `SELECT *` — the
//! Query API returns the `columns`/`types` for the expanded projection even when
//! no rows match, so no data has to be fetched to build the schema.

use crate::database::posthog::PosthogHttp;
use crate::database::types::{ColumnInfo, DatabaseSchema, TableInfo};
use crate::Error;

/// The HogQL top-level tables surfaced in the sidebar.
const TABLES: &[&str] = &[
    "events",
    "persons",
    "sessions",
    "groups",
    "cohort_people",
    "raw_sessions",
];

/// Builds the `DatabaseSchema` for a PostHog project: one `TableInfo` per
/// curated HogQL table, with columns reflected from a zero-row `SELECT *`.
pub async fn get_database_schema(http: &PosthogHttp) -> Result<DatabaseSchema, Error> {
    let mut tables = Vec::new();
    let mut unique_columns = std::collections::BTreeSet::new();

    for &table in TABLES {
        let columns = match reflect_columns(http, table).await {
            Ok(columns) => columns,
            // A single unreachable/renamed table must not sink the whole schema
            // load — skip it and keep the others browsable.
            Err(_) => continue,
        };

        for column in &columns {
            unique_columns.insert(column.name.clone());
        }

        tables.push(TableInfo {
            name: table.to_string(),
            schema: String::new(),
            columns,
            primary_key_columns: Vec::new(),
            indexes: Vec::new(),
            row_count_estimate: count_rows(http, table).await,
        });
    }

    Ok(DatabaseSchema {
        tables,
        schemas: Vec::new(),
        unique_columns: unique_columns.into_iter().collect(),
    })
}

/// Estimates a table's row count with a HogQL `count()`. Runs read-only against
/// ClickHouse so it's cheap even on the `events` table. Returns `None` when the
/// count can't be read (unreachable table, non-numeric cell) so the sidebar
/// falls back to hiding the badge rather than showing a wrong number.
async fn count_rows(http: &PosthogHttp, table: &str) -> Option<u64> {
    let set = http
        .query(&format!("SELECT count() FROM {table}"))
        .await
        .ok()?;
    let cell = set.rows.first()?.first()?;
    cell.as_u64()
        .or_else(|| cell.as_str().and_then(|text| text.parse().ok()))
}

/// Reflects a table's columns by running a zero-row `SELECT *` and reading the
/// returned `columns`/`types` metadata.
async fn reflect_columns(http: &PosthogHttp, table: &str) -> Result<Vec<ColumnInfo>, Error> {
    let set = http.query(&format!("SELECT * FROM {table} LIMIT 0")).await?;
    Ok(set
        .columns
        .iter()
        .enumerate()
        .map(|(index, name)| ColumnInfo {
            name: name.clone(),
            data_type: set
                .types
                .get(index)
                .and_then(|t| t.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            is_nullable: true,
            default_value: None,
            is_primary_key: false,
            is_auto_increment: false,
            foreign_key: None,
            allowed_values: None,
        })
        .collect())
}

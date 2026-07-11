//! PostHog HogQL schema introspection over HTTP.
//!
//! PostHog has no `information_schema` to query, but its Query API exposes a
//! `DatabaseSchemaQuery` kind — the same call that powers PostHog's own SQL
//! editor sidebar. One request returns every table the project can query: the
//! built-in HogQL tables, any data-warehouse tables synced from external sources
//! (Stripe, Postgres, S3, …), and saved/materialized views, each with its full
//! field list. If that call fails we fall back to reflecting a small curated set
//! of built-in tables with zero-row `SELECT *`s.

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use serde_json::Value;

use crate::database::posthog::PosthogHttp;
use crate::database::types::{ColumnInfo, DatabaseSchema, TableInfo};
use crate::Error;

/// Built-in HogQL tables used only when `DatabaseSchemaQuery` is unavailable.
const FALLBACK_TABLES: &[&str] = &[
    "events",
    "persons",
    "sessions",
    "groups",
    "cohort_people",
    "raw_sessions",
];

/// Field types that describe a *relation* to another table rather than a
/// selectable column (`person` on `events`, for example). They are not part of a
/// `SELECT *` projection, so listing them as columns would produce broken
/// generated queries.
const RELATIONAL_FIELD_TYPES: &[&str] = &["lazy_table", "virtual_table", "field_traverser", "view"];

/// Table kinds whose row count is cheap and meaningful. Views are skipped: they
/// can wrap arbitrarily expensive HogQL, and a sidebar badge is not worth paying
/// for that on every schema load.
const COUNTABLE_TABLE_TYPES: &[&str] = &["posthog", "data_warehouse"];

/// One table in the `DatabaseSchemaQuery` response.
#[derive(Debug, Deserialize)]
struct SchemaTable {
    name: String,
    #[serde(default)]
    #[serde(rename = "type")]
    table_type: String,
    #[serde(default)]
    fields: BTreeMap<String, SchemaField>,
}

#[derive(Debug, Deserialize)]
struct SchemaField {
    name: String,
    #[serde(default)]
    #[serde(rename = "type")]
    field_type: String,
}

#[derive(Debug, Deserialize)]
struct DatabaseSchemaResponse {
    #[serde(default)]
    tables: BTreeMap<String, SchemaTable>,
}

/// Builds the `DatabaseSchema` for a PostHog project from a single
/// `DatabaseSchemaQuery`, falling back to reflecting the curated built-in tables
/// when that query kind is unavailable.
pub async fn get_database_schema(http: &PosthogHttp) -> Result<DatabaseSchema, Error> {
    let mut tables = match fetch_schema_tables(http).await {
        Ok(tables) if !tables.is_empty() => tables,
        _ => fallback_tables(http).await,
    };

    let counts = row_counts(http, &tables).await;
    for table in &mut tables {
        table.row_count_estimate = counts.get(&table.name).copied();
    }

    // Built-in tables first, then warehouse tables, then views — each group
    // alphabetically, so the sidebar leads with what most projects browse.
    tables.sort_by(|a, b| {
        type_rank(&a.schema)
            .cmp(&type_rank(&b.schema))
            .then_with(|| a.name.cmp(&b.name))
    });

    let unique_columns = tables
        .iter()
        .flat_map(|table| table.columns.iter().map(|column| column.name.clone()))
        .collect::<BTreeSet<_>>();

    Ok(DatabaseSchema {
        tables,
        schemas: Vec::new(),
        unique_columns: unique_columns.into_iter().collect(),
    })
}

fn type_rank(table_type: &str) -> u8 {
    match table_type {
        "posthog" => 0,
        "data_warehouse" => 1,
        _ => 2,
    }
}

/// Asks the Query API for the whole database schema in one call.
async fn fetch_schema_tables(http: &PosthogHttp) -> Result<Vec<TableInfo>, Error> {
    let body = http
        .post_query(serde_json::json!({ "kind": "DatabaseSchemaQuery" }))
        .await?;

    let parsed: DatabaseSchemaResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode PostHog database schema: {error}"
        ))
    })?;

    Ok(parsed
        .tables
        .into_values()
        .map(|table| TableInfo {
            name: table.name,
            schema: table.table_type,
            columns: table
                .fields
                .into_values()
                .filter(|field| !RELATIONAL_FIELD_TYPES.contains(&field.field_type.as_str()))
                .map(|field| column(field.name, field.field_type))
                .collect(),
            primary_key_columns: Vec::new(),
            indexes: Vec::new(),
            row_count_estimate: None,
        })
        .filter(|table| !table.columns.is_empty())
        .collect())
}

/// Reflects the curated built-in tables with zero-row `SELECT *`s. Used only
/// when `DatabaseSchemaQuery` is unavailable; a table that fails to reflect is
/// skipped so one bad table can't sink the whole sidebar.
async fn fallback_tables(http: &PosthogHttp) -> Vec<TableInfo> {
    let mut tables = Vec::new();

    for &name in FALLBACK_TABLES {
        let Ok(set) = http.query(&format!("SELECT * FROM {name} LIMIT 0")).await else {
            continue;
        };

        tables.push(TableInfo {
            name: name.to_string(),
            schema: "posthog".to_string(),
            columns: set
                .columns
                .iter()
                .enumerate()
                .map(|(index, column_name)| {
                    let data_type = set
                        .types
                        .get(index)
                        .and_then(|t| t.clone())
                        .unwrap_or_else(|| "unknown".to_string());
                    column(column_name.clone(), data_type)
                })
                .collect(),
            primary_key_columns: Vec::new(),
            indexes: Vec::new(),
            row_count_estimate: None,
        });
    }

    tables
}

fn column(name: String, data_type: String) -> ColumnInfo {
    ColumnInfo {
        name,
        data_type,
        is_nullable: true,
        default_value: None,
        is_primary_key: false,
        is_auto_increment: false,
        foreign_key: None,
        allowed_values: None,
    }
}

/// Counts every countable table in a single batched HogQL query. Counts are a
/// sidebar nicety, so any failure yields no counts at all rather than a fan-out
/// of per-table retries.
async fn row_counts(http: &PosthogHttp, tables: &[TableInfo]) -> BTreeMap<String, u64> {
    let countable = tables
        .iter()
        .filter(|table| COUNTABLE_TABLE_TYPES.contains(&table.schema.as_str()))
        .filter(|table| is_plain_identifier(&table.name))
        .map(|table| table.name.as_str())
        .collect::<Vec<_>>();

    if countable.is_empty() {
        return BTreeMap::new();
    }

    let hogql = countable
        .iter()
        .map(|name| format!("SELECT '{name}' AS table_name, count() AS row_count FROM {name}"))
        .collect::<Vec<_>>()
        .join(" UNION ALL ");

    let Ok(set) = http.query(&hogql).await else {
        return BTreeMap::new();
    };

    set.rows
        .iter()
        .filter_map(|row| {
            let name = row.first()?.as_str()?.to_string();
            Some((name, as_u64(row.get(1)?)?))
        })
        .collect()
}

/// Guards the batched count query against injection through warehouse table
/// names, which are user-supplied.
fn is_plain_identifier(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}

fn as_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relational_fields_are_not_listed_as_columns() {
        let body = r#"{
            "tables": {
                "events": {
                    "name": "events",
                    "type": "posthog",
                    "fields": {
                        "uuid": { "name": "uuid", "type": "string" },
                        "person": { "name": "person", "type": "lazy_table" },
                        "pdi": { "name": "pdi", "type": "field_traverser" }
                    }
                }
            }
        }"#;
        let parsed: DatabaseSchemaResponse = serde_json::from_str(body).expect("decodes");
        let events = &parsed.tables["events"];
        let selectable = events
            .fields
            .values()
            .filter(|f| !RELATIONAL_FIELD_TYPES.contains(&f.field_type.as_str()))
            .map(|f| f.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(selectable, vec!["uuid"]);
    }

    #[test]
    fn warehouse_and_view_tables_decode() {
        let body = r#"{
            "tables": {
                "stripe_charge": { "name": "stripe_charge", "type": "data_warehouse", "fields": {} },
                "weekly_signups": { "name": "weekly_signups", "type": "view", "fields": {} }
            }
        }"#;
        let parsed: DatabaseSchemaResponse = serde_json::from_str(body).expect("decodes");
        assert_eq!(parsed.tables["stripe_charge"].table_type, "data_warehouse");
        assert_eq!(parsed.tables["weekly_signups"].table_type, "view");
    }

    #[test]
    fn built_in_tables_sort_ahead_of_warehouse_and_views() {
        assert!(type_rank("posthog") < type_rank("data_warehouse"));
        assert!(type_rank("data_warehouse") < type_rank("view"));
        assert!(type_rank("data_warehouse") < type_rank("materialized_view"));
    }

    #[test]
    fn only_plain_identifiers_are_counted() {
        assert!(is_plain_identifier("events"));
        assert!(is_plain_identifier("$sessions"));
        assert!(!is_plain_identifier("events; DROP"));
        assert!(!is_plain_identifier("bad`name"));
        assert!(!is_plain_identifier(""));
    }

    #[test]
    fn counts_parse_from_string_or_number_cells() {
        assert_eq!(as_u64(&Value::from(42)), Some(42));
        assert_eq!(as_u64(&Value::from("42")), Some(42));
        assert_eq!(as_u64(&Value::Null), None);
    }
}

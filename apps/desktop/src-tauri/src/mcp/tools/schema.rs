use std::sync::Arc;

use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    database::types::TableInfo,
    mcp::{
        errors::{McpErrorCode, McpFailure},
        grants::{require_sql_access, Access},
        state::McpState,
    },
};

const DEFAULT_TABLE_LIMIT: usize = 100;
const MAX_TABLE_LIMIT: usize = 500;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ListTablesArgs {
    connection: Uuid,
    schema: Option<String>,
    name_contains: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DescribeTableArgs {
    connection: Uuid,
    table: String,
    schema: Option<String>,
}

pub async fn list_tables(state: &Arc<McpState>, args: ListTablesArgs) -> Result<Value, McpFailure> {
    let (info, profile) = require_sql_access(state, args.connection, Access::Read)?;
    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    state.ensure_read(args.connection, &info, &profile).await?;
    let schema = state.schema(args.connection, &info).await?;

    let needle = args.name_contains.map(|name| name.to_lowercase());
    let matching: Vec<&TableInfo> = schema
        .tables
        .iter()
        .filter(|table| {
            args.schema
                .as_ref()
                .is_none_or(|name| &table.schema == name)
        })
        .filter(|table| {
            needle
                .as_ref()
                .is_none_or(|needle| table.name.to_lowercase().contains(needle))
        })
        .collect();

    let total = matching.len();
    let offset = args.offset.unwrap_or(0);
    let limit = args
        .limit
        .unwrap_or(DEFAULT_TABLE_LIMIT)
        .clamp(1, MAX_TABLE_LIMIT);
    let tables: Vec<Value> = matching
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|table| {
            json!({
                "schema": table.schema,
                "name": table.name,
                "estimated_rows": table.row_count_estimate,
            })
        })
        .collect();
    let truncated = offset.saturating_add(tables.len()) < total;
    Ok(json!({ "tables": tables, "total": total, "truncated": truncated }))
}

pub async fn describe_table(
    state: &Arc<McpState>,
    args: DescribeTableArgs,
) -> Result<Value, McpFailure> {
    let (info, profile) = require_sql_access(state, args.connection, Access::Read)?;
    let lock = state.connection_lock(args.connection);
    let _guard = lock.lock().await;
    state.ensure_read(args.connection, &info, &profile).await?;
    let schema = state.schema(args.connection, &info).await?;

    let matches: Vec<&TableInfo> = schema
        .tables
        .iter()
        .filter(|table| table.name == args.table)
        .filter(|table| {
            args.schema
                .as_ref()
                .is_none_or(|name| &table.schema == name)
        })
        .collect();
    let table = match matches.as_slice() {
        [table] => *table,
        [] => {
            return Err(McpFailure::new(
                McpErrorCode::InvalidInput,
                format!("Table '{}' was not found.", args.table),
            ))
        }
        many => {
            let schemas: Vec<&str> = many.iter().map(|table| table.schema.as_str()).collect();
            return Err(McpFailure::new(
                McpErrorCode::AmbiguousTable,
                "This table exists in more than one schema. Pass a schema.",
            )
            .with_details(json!({ "schemas": schemas })));
        }
    };

    let columns: Vec<Value> = table
        .columns
        .iter()
        .map(|column| {
            json!({
                "name": column.name,
                "type": column.data_type,
                "nullable": column.is_nullable,
                "default": column.default_value,
                "primary_key": column.is_primary_key,
            })
        })
        .collect();
    let foreign_keys: Vec<Value> = table
        .columns
        .iter()
        .filter_map(|column| {
            let foreign_key = column.foreign_key.as_ref()?;
            Some(json!({
                "column": column.name,
                "references_schema": foreign_key.referenced_schema,
                "references_table": foreign_key.referenced_table,
                "references_column": foreign_key.referenced_column,
            }))
        })
        .collect();
    let indexes: Vec<Value> = table
        .indexes
        .iter()
        .map(|index| {
            json!({
                "name": index.name,
                "columns": index.column_names,
                "unique": index.is_unique,
                "primary": index.is_primary,
            })
        })
        .collect();

    Ok(json!({
        "schema": table.schema,
        "name": table.name,
        "columns": columns,
        "indexes": indexes,
        "foreign_keys": foreign_keys,
    }))
}

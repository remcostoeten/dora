use std::sync::Arc;
use anyhow::{Context, anyhow};
use dashmap::DashMap;
use tracing::instrument;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use base64::Engine;
use mysql_async::prelude::Queryable;
use mysql_async::{Row as MySqlRow, Value as MySqlValue};

use crate::{
    database::{
        maintenance::{self, SoftDeleteResult, TruncateResult, DumpResult},
        types::{DatabaseClient, DatabaseConnection, DatabaseSchema},
    },
    error::Error,
};

use super::metadata::MetadataService;

/// Export format options
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Json,
    SqlInsert,
    Csv,
}

/// Result of a mutation operation
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct MutationResult {
    pub success: bool,
    pub affected_rows: usize,
    pub message: Option<String>,
}

pub struct MutationService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub schemas: &'a DashMap<Uuid, Arc<DatabaseSchema>>,
}

impl<'a> MutationService<'a> {
    /// Build a [`WriteAdapter`] for the given connection.
    fn write_adapter(&self, connection_id: Uuid) -> Result<(crate::database::adapter::BoxedWriteAdapter, Uuid), Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;
        let client = connection_entry.value().get_client()?;
        Ok((crate::database::adapter::write_adapter_from_client(&client), connection_id))
    }

    #[instrument(skip(self, primary_key_value, new_value), fields(connection_id = %connection_id, table = %table_name))]
    pub async fn update_cell(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_value: serde_json::Value,
        column_name: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter
            .update_cell(table_name, schema_name, primary_key_column, primary_key_value, column_name, new_value)
            .await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    #[instrument(skip(self, primary_key_values), fields(connection_id = %connection_id, table = %table_name))]
    pub async fn delete_rows(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter
            .delete_rows(table_name, schema_name, primary_key_column, primary_key_values)
            .await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    #[instrument(skip(self, row_data), fields(connection_id = %connection_id, table = %table_name))]
    pub async fn insert_row(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter.insert_row(table_name, schema_name, row_data).await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    pub async fn duplicate_row(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter
            .duplicate_row(table_name, schema_name, primary_key_column, primary_key_value)
            .await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    pub async fn export_table(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        format: ExportFormat,
        limit: Option<u32>,
    ) -> Result<String, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let (query, db_type) = match &client {
            DatabaseClient::Postgres { .. } => {
                let schema_prefix = schema_name
                    .as_ref()
                    .map(|s| format!("\"{}\".", s))
                    .unwrap_or_default();
                let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
                (
                    format!(
                        "SELECT * FROM {}\"{}\"{}",
                        schema_prefix, table_name, limit_clause
                    ),
                    "postgres",
                )
            }
            DatabaseClient::SQLite { .. } => {
                let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
                (
                    format!("SELECT * FROM \"{}\"{}",  table_name, limit_clause),
                    "sqlite",
                )
            }
            DatabaseClient::LibSQL { .. } => {
                let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
                (
                    format!("SELECT * FROM `{}`{}",  table_name, limit_clause),
                    "libsql",
                )
            }
            DatabaseClient::MySQL { .. } => {
                let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
                (
                    format!("SELECT * FROM `{}`{}",  table_name, limit_clause),
                    "mysql",
                )
            }
        };

        let (columns, rows) = match db_type {
            "postgres" => fetch_postgres_data(&client, &query).await?,
            "sqlite" => fetch_sqlite_data(&client, &query)?,
            "libsql" => fetch_libsql_data(&client, &query).await?,
            "mysql" => fetch_mysql_data(&client, &query).await?,
            _ => unreachable!(),
        };

        let output = match format {
            ExportFormat::Json => {
                let data: Vec<serde_json::Map<String, serde_json::Value>> = rows
                    .iter()
                    .map(|row| {
                        columns
                            .iter()
                            .zip(row.iter())
                            .map(|(col, val)| (col.clone(), val.clone()))
                            .collect()
                    })
                    .collect();
                serde_json::to_string_pretty(&data)?
            }
            ExportFormat::SqlInsert => {
                let is_mysql = db_type == "mysql";
                let schema_prefix = if is_mysql {
                    schema_name
                        .as_ref()
                        .map(|s| format!("{}.", mysql_quote_identifier(s)))
                        .unwrap_or_default()
                } else {
                    schema_name
                        .as_ref()
                        .map(|s| format!("\"{}\".", s))
                        .unwrap_or_default()
                };
                let table_name_sql = if is_mysql {
                    mysql_quote_identifier(&table_name)
                } else {
                    format!("\"{}\"", table_name)
                };
                let column_list = if is_mysql {
                    columns
                        .iter()
                        .map(|c| mysql_quote_identifier(c))
                        .collect::<Vec<_>>()
                        .join(", ")
                } else {
                    columns
                        .iter()
                        .map(|c| format!("\"{}\"", c))
                        .collect::<Vec<_>>()
                        .join(", ")
                };

                rows.iter()
                    .map(|row| {
                        let values: Vec<String> = row.iter().map(json_to_sql_literal).collect();
                        format!(
                            "INSERT INTO {}{} ({}) VALUES ({});",
                            schema_prefix,
                            table_name_sql,
                            column_list,
                            values.join(", ")
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            ExportFormat::Csv => {
                let mut output = columns.join(",") + "\n";
                for row in rows {
                    let values: Vec<String> = row
                        .iter()
                        .map(|v| match v {
                            serde_json::Value::String(s) => format!("\"{}\"", s.replace("\"", "\"\"")),
                            serde_json::Value::Null => String::new(),
                            other => other.to_string(),
                        })
                        .collect();
                    output.push_str(&values.join(","));
                    output.push('\n');
                }
                output
            }
        };

        Ok(output)
    }

    pub async fn soft_delete_rows(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        // Resolve the soft-delete column before adapter dispatch
        let resolved_col = if let Some(col) = soft_delete_column {
            Some(col)
        } else {
            let metadata_svc = MetadataService {
                connections: self.connections,
                schemas: self.schemas,
            };
            let schema = metadata_svc.get_database_schema(connection_id).await?;
            let table = schema.tables.iter()
                .find(|t| t.name == table_name)
                .ok_or_else(|| Error::Any(anyhow!("Table not found: {}", table_name)))?;

            let columns: Vec<String> = table.columns.iter().map(|c| c.name.clone()).collect();
            Some(maintenance::find_soft_delete_column(&columns)
                .ok_or_else(|| Error::Any(anyhow!(
                    "No soft delete column found. Expected: deleted_at, is_deleted, or similar"
                )))?)
        };

        let (adapter, _) = self.write_adapter(connection_id)?;
        adapter
            .soft_delete_rows(table_name, schema_name, primary_key_column, primary_key_values, resolved_col)
            .await
    }

    pub async fn undo_soft_delete(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_values: Vec<serde_json::Value>,
        soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        let (adapter, _) = self.write_adapter(connection_id)?;
        adapter
            .undo_soft_delete(table_name, schema_name, primary_key_column, primary_key_values, soft_delete_column)
            .await
    }

    pub async fn truncate_table(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter.truncate_table(table_name, schema_name, cascade).await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    pub async fn truncate_database(
        &self,
        connection_id: Uuid,
        schema_name: Option<String>,
        confirm: bool,
    ) -> Result<TruncateResult, Error> {
        if !confirm {
            return Err(Error::Any(anyhow!(
                "Truncate database requires explicit confirmation (confirm: true)"
            )));
        }
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter.truncate_database(schema_name, confirm).await?;
        self.schemas.remove(&cid);
        Ok(result)
    }

    pub async fn dump_database(
        &self,
        connection_id: Uuid,
        output_path: String,
    ) -> Result<DumpResult, Error> {
        let (adapter, _) = self.write_adapter(connection_id)?;
        adapter.dump_database(output_path).await
    }

    #[instrument(skip(self, statements), fields(connection_id = %connection_id, count = statements.len()))]
    pub async fn execute_batch(
        &self,
        connection_id: Uuid,
        statements: Vec<String>,
    ) -> Result<MutationResult, Error> {
        let (adapter, cid) = self.write_adapter(connection_id)?;
        let result = adapter.execute_batch(statements).await?;
        self.schemas.remove(&cid);
        Ok(result)
    }
}

// Helpers
pub(crate) fn qualified_table_name(table_name: &str, schema_name: Option<&str>) -> String {
    match schema_name {
        Some(schema_name) => format!("\"{schema_name}\".\"{table_name}\""),
        None => format!("\"{table_name}\""),
    }
}


pub fn json_to_pg_param(value: &serde_json::Value) -> Box<dyn tokio_postgres::types::ToSql + Sync + Send> {
    match value {
        serde_json::Value::Null => Box::new(Option::<String>::None),
        serde_json::Value::Bool(b) => Box::new(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(n.to_string())
            }
        }
        serde_json::Value::String(s) => Box::new(s.clone()),
        _ => Box::new(value.to_string()),
    }
}

pub fn json_to_sqlite_value(value: &serde_json::Value) -> rusqlite::types::Value {
    match value {
        serde_json::Value::Null => rusqlite::types::Value::Null,
        serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Text(n.to_string())
            }
        }
        serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        _ => rusqlite::types::Value::Text(value.to_string()),
    }
}

pub(crate) fn json_to_libsql_value(value: &serde_json::Value) -> libsql::Value {
    match value {
        serde_json::Value::Null => libsql::Value::Null,
        serde_json::Value::Bool(b) => libsql::Value::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                libsql::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                libsql::Value::Real(f)
            } else {
                libsql::Value::Text(n.to_string())
            }
        }
        serde_json::Value::String(s) => libsql::Value::Text(s.clone()),
        _ => libsql::Value::Text(value.to_string()),
    }
}

pub(crate) fn json_to_mysql_value(value: &serde_json::Value) -> MySqlValue {
    match value {
        serde_json::Value::Null => MySqlValue::NULL,
        serde_json::Value::Bool(value) => MySqlValue::Int(if *value { 1 } else { 0 }),
        serde_json::Value::Number(value) => {
            if let Some(int) = value.as_i64() {
                MySqlValue::Int(int)
            } else if let Some(uint) = value.as_u64() {
                MySqlValue::UInt(uint)
            } else if let Some(float) = value.as_f64() {
                MySqlValue::Double(float)
            } else {
                MySqlValue::Bytes(value.to_string().into_bytes())
            }
        }
        serde_json::Value::String(value) => MySqlValue::Bytes(value.as_bytes().to_vec()),
        _ => MySqlValue::Bytes(value.to_string().into_bytes()),
    }
}

pub(crate) fn json_to_sql_literal(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        _ => format!("'{}'", value.to_string().replace('\'', "''")),
    }
}

async fn fetch_postgres_data(
    client: &DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let DatabaseClient::Postgres { client } = client {
        let rows = client.query(query, &[]).await?;
        if rows.is_empty() {
            return Ok((vec![], vec![]));
        }

        let columns: Vec<String> = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect();

        let data: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                row.columns()
                    .iter()
                    .enumerate()
                    .map(|(i, _col)| pg_value_to_json(row, i))
                    .collect()
            })
            .collect();

        Ok((columns, data))
    } else {
        Err(Error::Any(anyhow!("Expected Postgres client")))
    }
}

fn fetch_sqlite_data(
    client: &DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let DatabaseClient::SQLite { connection } = client {
        let conn = connection.lock().map_err(|_| crate::Error::Internal("Mutex poisoned".into()))?;
        let mut stmt = conn.prepare(query)?;
        let columns: Vec<String> = stmt
            .column_names()
            .into_iter()
            .map(|s| s.to_string())
            .collect();

        let rows: Result<Vec<Vec<serde_json::Value>>, rusqlite::Error> = stmt
            .query_map([], |row| {
                let values: Vec<serde_json::Value> = (0..columns.len())
                    .map(|i| sqlite_value_to_json(row, i))
                    .collect();
                Ok(values)
            })?
            .collect();

        Ok((columns, rows?))
    } else {
        Err(Error::Any(anyhow!("Expected SQLite client")))
    }
}

async fn fetch_libsql_data(
    client: &DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let DatabaseClient::LibSQL { connection } = client {
        let mut rows = connection
            .query(query, ())
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL query failed: {}", e)))?;

        let columns: Vec<String> = (0..rows.column_count())
            .filter_map(|i| rows.column_name(i as i32).map(|s| s.to_string()))
            .collect();

        let mut data = Vec::new();
        while let Some(row) = rows.next().await.map_err(|e| Error::Any(anyhow!("LibSQL fetch failed: {}", e)))? {
            let values: Vec<serde_json::Value> = (0..columns.len())
                .map(|i| libsql_value_to_json(&row, i as i32))
                .collect();
            data.push(values);
        }

        Ok((columns, data))
    } else {
        Err(Error::Any(anyhow!("Expected LibSQL client")))
    }
}

async fn fetch_mysql_data(
    client: &DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let DatabaseClient::MySQL { pool } = client {
        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        let mut result = conn
            .query_iter(query)
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL query failed: {}", e)))?;

        let columns: Vec<String> = result
            .columns_ref()
            .iter()
            .map(|column| column.name_str().to_string())
            .collect();

        let rows = result
            .collect::<MySqlRow>()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL row collection failed: {}", e)))?;

        let data = rows
            .into_iter()
            .map(|row| {
                row.unwrap()
                    .into_iter()
                    .map(mysql_value_to_json)
                    .collect::<Vec<_>>()
            })
            .collect();

        Ok((columns, data))
    } else {
        Err(Error::Any(anyhow!("Expected MySQL client")))
    }
}

pub(crate) fn pg_value_to_json(row: &tokio_postgres::Row, idx: usize) -> serde_json::Value {
    use tokio_postgres::types::Type;

    let col = &row.columns()[idx];
    let col_type = col.type_();

    match *col_type {
        Type::BOOL => row.get::<_, Option<bool>>(idx).map_or(serde_json::Value::Null, |v| serde_json::Value::Bool(v)),
        Type::INT2 => row.get::<_, Option<i16>>(idx).map_or(serde_json::Value::Null, |v| serde_json::json!(v)),
        Type::INT4 => row.get::<_, Option<i32>>(idx).map_or(serde_json::Value::Null, |v| serde_json::json!(v)),
        Type::INT8 => row.get::<_, Option<i64>>(idx).map_or(serde_json::Value::Null, |v| serde_json::json!(v)),
        Type::FLOAT4 => row.get::<_, Option<f32>>(idx).map_or(serde_json::Value::Null, |v| serde_json::json!(v)),
        Type::FLOAT8 => row.get::<_, Option<f64>>(idx).map_or(serde_json::Value::Null, |v| serde_json::json!(v)),
        Type::TEXT | Type::VARCHAR | Type::CHAR | Type::NAME => {
            row.get::<_, Option<String>>(idx).map_or(serde_json::Value::Null, serde_json::Value::String)
        }
        Type::BYTEA => {
            row.get::<_, Option<Vec<u8>>>(idx).map_or(serde_json::Value::Null, |v| {
                serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(&v))
            })
        }
        Type::JSON | Type::JSONB => {
            row.get::<_, Option<serde_json::Value>>(idx).unwrap_or(serde_json::Value::Null)
        }
        _ => {
            // Try as string
            row.try_get::<_, Option<String>>(idx)
                .ok()
                .flatten()
                .map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null)
        }
    }
}

pub(crate) fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
    use rusqlite::types::ValueRef;

    match row.get_ref(idx) {
        Ok(ValueRef::Null) => serde_json::Value::Null,
        Ok(ValueRef::Integer(i)) => serde_json::json!(i),
        Ok(ValueRef::Real(f)) => serde_json::json!(f),
        Ok(ValueRef::Text(t)) => {
            serde_json::Value::String(String::from_utf8_lossy(t).to_string())
        }
        Ok(ValueRef::Blob(b)) => {
            serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(b))
        }
        Err(_) => serde_json::Value::Null,
    }
}

pub(crate) fn libsql_value_to_json(row: &libsql::Row, idx: i32) -> serde_json::Value {
    match row.get_value(idx) {
        Ok(libsql::Value::Null) => serde_json::Value::Null,
        Ok(libsql::Value::Integer(i)) => serde_json::json!(i),
        Ok(libsql::Value::Real(f)) => serde_json::json!(f),
        Ok(libsql::Value::Text(t)) => serde_json::Value::String(t),
        Ok(libsql::Value::Blob(b)) => {
            serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(&b))
        }
        Err(_) => serde_json::Value::Null,
    }
}

pub(crate) fn mysql_value_to_json(value: MySqlValue) -> serde_json::Value {
    match value {
        MySqlValue::NULL => serde_json::Value::Null,
        MySqlValue::Bytes(bytes) => match String::from_utf8(bytes) {
            Ok(text) => serde_json::Value::String(text),
            Err(err) => {
                serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(err.into_bytes()))
            }
        },
        MySqlValue::Int(value) => serde_json::Value::from(value),
        MySqlValue::UInt(value) => serde_json::Value::from(value),
        MySqlValue::Float(value) => serde_json::Value::from(value),
        MySqlValue::Double(value) => serde_json::Value::from(value),
        MySqlValue::Date(year, month, day, hour, minute, second, micros) => serde_json::Value::from(format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
            year, month, day, hour, minute, second, micros
        )),
        MySqlValue::Time(neg, days, hours, minutes, seconds, micros) => serde_json::Value::from(format!(
            "{}{} {:02}:{:02}:{:02}.{:06}",
            if neg { "-" } else { "" },
            days,
            hours,
            minutes,
            seconds,
            micros
        )),
    }
}

pub(crate) fn mysql_quote_identifier(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

pub(crate) fn mysql_qualified_table_name(table_name: &str, schema_name: Option<&str>) -> String {
    match schema_name {
        Some(schema_name) => format!(
            "{}.{}",
            mysql_quote_identifier(schema_name),
            mysql_quote_identifier(table_name)
        ),
        None => mysql_quote_identifier(table_name),
    }
}

#[cfg(test)]
mod tests {
    use super::qualified_table_name;

    #[test]
    fn qualified_table_name_without_schema_quotes_table() {
        assert_eq!(qualified_table_name("users", None), "\"users\"");
    }

    #[test]
    fn qualified_table_name_with_schema_quotes_schema_and_table() {
        assert_eq!(
            qualified_table_name("users", Some("public")),
            "\"public\".\"users\""
        );
    }
}

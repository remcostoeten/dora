use std::sync::Arc;
use anyhow::{Context, anyhow};
use dashmap::DashMap;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use base64::Engine;

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
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        // Build the UPDATE query
        let (query, db_type) = match &client {
            DatabaseClient::Postgres { .. } => {
                let schema_prefix = schema_name
                    .as_ref()
                    .map(|s| format!("\"{}\".", s))
                    .unwrap_or_default();
                let query = format!(
                    "UPDATE \"{table_name}\" SET \"{column_name}\" = $1 WHERE \"{primary_key_column}\" = $2",
                );
                (format!("{}{}", schema_prefix, query), "postgres")
            }
            DatabaseClient::SQLite { .. } => {
                let query = format!(
                    "UPDATE \"{table_name}\" SET \"{column_name}\" = ? WHERE \"{primary_key_column}\" = ?"
                );
                (query, "sqlite")
            }
            DatabaseClient::LibSQL { .. } => {
                let query = format!(
                    "UPDATE \"{table_name}\" SET \"{column_name}\" = ? WHERE \"{primary_key_column}\" = ?"
                );
                (query, "libsql")
            }
        };

        // Execute the query
        let result = match db_type {
            "postgres" => {
                execute_postgres_update(&client, &query, &new_value, &primary_key_value).await?
            }
            "sqlite" => execute_sqlite_update(&client, &query, &new_value, &primary_key_value)?,
            "libsql" => execute_libsql_update(&client, &query, &new_value, &primary_key_value).await?,
            _ => unreachable!(),
        };

        // Invalidate cached schema as data changed
        self.schemas.remove(&connection_id);

        Ok(MutationResult {
            success: result > 0,
            affected_rows: result,
            message: if result > 0 {
                Some(format!("Updated {} row(s)", result))
            } else {
                Some("No rows were updated".to_string())
            },
        })
    }

    pub async fn delete_rows(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        primary_key_column: String,
        primary_key_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if primary_key_values.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No rows to delete".to_string()),
            });
        }

        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let total_deleted = match &client {
            DatabaseClient::Postgres { client } => {
                let schema_prefix = schema_name
                    .as_ref()
                    .map(|s| format!("\"{}\".", s))
                    .unwrap_or_default();

                let placeholders: Vec<String> = (1..=primary_key_values.len())
                    .map(|i| format!("${}", i))
                    .collect();
                let query = format!(
                    "DELETE FROM {}\"{table_name}\" WHERE \"{primary_key_column}\" IN ({})",
                    schema_prefix,
                    placeholders.join(", ")
                );

                let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> =
                    primary_key_values
                        .iter()
                        .map(|v| json_to_pg_param(v))
                        .collect();
                let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
                    .iter()
                    .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
                    .collect();

                client.execute(&query, &params_ref[..]).await? as usize
            }
            DatabaseClient::SQLite { connection } => {
                let conn = connection.lock().unwrap();

                let placeholders: Vec<&str> = primary_key_values.iter().map(|_| "?").collect();
                let query = format!(
                    "DELETE FROM \"{table_name}\" WHERE \"{primary_key_column}\" IN ({})",
                    placeholders.join(", ")
                );

                let params: Vec<rusqlite::types::Value> = primary_key_values
                    .iter()
                    .map(json_to_sqlite_value)
                    .collect();
                let params_ref: Vec<&dyn rusqlite::ToSql> =
                    params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();

                conn.execute(&query, params_ref.as_slice())? as usize
            }
            DatabaseClient::LibSQL { connection } => {
                let placeholders: Vec<&str> = primary_key_values.iter().map(|_| "?").collect();
                let query = format!(
                    "DELETE FROM \"{table_name}\" WHERE \"{primary_key_column}\" IN ({})",
                    placeholders.join(", ")
                );

                let params: Vec<libsql::Value> = primary_key_values
                    .iter()
                    .map(json_to_libsql_value)
                    .collect();

                connection
                    .execute(&query, params)
                    .await
                    .map_err(|e| Error::Any(anyhow!("LibSQL delete failed: {}", e)))?
                    as usize
            }
        };

        self.schemas.remove(&connection_id);

        Ok(MutationResult {
            success: total_deleted > 0,
            affected_rows: total_deleted,
            message: Some(format!("Deleted {} row(s)", total_deleted)),
        })
    }

    pub async fn insert_row(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        if row_data.is_empty() {
             return Ok(MutationResult {
                success: false,
                affected_rows: 0,
                message: Some("No data to insert".to_string()),
            });
        }

        // Optimization: Use references to avoid cloning keys/values into new Vecs
        // We still need to collect keys for the query string since we iterate twice (cols then values)
        // But for values we can map directly to params.
        
        let columns: Vec<&String> = row_data.keys().collect();
        let values_len = row_data.len();

        let (affected_rows, message) = match &client {
             DatabaseClient::Postgres { client } => {
                let schema_prefix = schema_name
                    .as_ref()
                    .map(|s| format!("\"{}\".", s))
                    .unwrap_or_default();
                
                let col_names: String = columns.iter()
                    .map(|c| format!("\"{}\"", c))
                    .collect::<Vec<_>>()
                    .join(", ");
                
                let placeholders: String = (1..=values_len)
                    .map(|i| format!("${}", i))
                    .collect::<Vec<_>>()
                    .join(", ");
                
                let query = format!(
                    "INSERT INTO {}\"{}\" ({}) VALUES ({})",
                    schema_prefix, table_name, col_names, placeholders
                );

                let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = row_data
                    .values()
                    .map(|v| json_to_pg_param(v))
                    .collect();
                 let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
                    .iter()
                    .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
                    .collect();

                let rows = client.execute(&query, &params_ref[..]).await?;
                (rows as usize, format!("Inserted {} row(s)", rows))
            }
            DatabaseClient::SQLite { connection } => {
                let conn = connection.lock().unwrap();
                let col_names: String = columns.iter()
                    .map(|c| format!("\"{}\"", c))
                    .collect::<Vec<_>>()
                    .join(", ");
                
                let placeholders: String = std::iter::repeat("?")
                    .take(values_len)
                    .collect::<Vec<_>>()
                    .join(", ");

                let query = format!(
                     "INSERT INTO \"{}\" ({}) VALUES ({})",
                     table_name, col_names, placeholders
                );

                let params: Vec<rusqlite::types::Value> = row_data
                    .values()
                    .map(json_to_sqlite_value)
                    .collect();
                let params_ref: Vec<&dyn rusqlite::ToSql> =
                    params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
                
                conn.execute(&query, params_ref.as_slice())?;
                (1, "Inserted 1 row".to_string())
            }
            DatabaseClient::LibSQL { connection } => {
                 let col_names: String = columns.iter()
                    .map(|c| format!("\"{}\"", c))
                    .collect::<Vec<_>>()
                    .join(", ");
                
                let placeholders: String = std::iter::repeat("?")
                     .take(values_len)
                     .collect::<Vec<_>>()
                     .join(", ");

                let query = format!(
                     "INSERT INTO \"{}\" ({}) VALUES ({})",
                     table_name, col_names, placeholders
                );

                let params: Vec<libsql::Value> = row_data
                     .values()
                     .map(json_to_libsql_value)
                     .collect();
                
                connection.execute(&query, params).await
                    .map_err(|e| Error::Any(anyhow!("LibSQL insert failed: {}", e)))?;
                (1, "Inserted 1 row".to_string())
            }
        };

        self.schemas.remove(&connection_id);

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(message),
        })
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
                    format!("SELECT * FROM \"{}\"{}",  table_name, limit_clause),
                    "libsql",
                )
            }
        };

        let (columns, rows) = match db_type {
            "postgres" => fetch_postgres_data(&client, &query).await?,
            "sqlite" => fetch_sqlite_data(&client, &query)?,
            "libsql" => fetch_libsql_data(&client, &query).await?,
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
                let schema_prefix = schema_name
                    .as_ref()
                    .map(|s| format!("\"{}\".", s))
                    .unwrap_or_default();
                let column_list = columns
                    .iter()
                    .map(|c| format!("\"{}\"", c))
                    .collect::<Vec<_>>()
                    .join(", ");

                rows.iter()
                    .map(|row| {
                        let values: Vec<String> = row.iter().map(json_to_sql_literal).collect();
                        format!(
                            "INSERT INTO {}\"{}\" ({}) VALUES ({});",
                            schema_prefix,
                            table_name,
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
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let soft_del_col = if let Some(col) = soft_delete_column {
            col
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
            maintenance::find_soft_delete_column(&columns)
                .ok_or_else(|| Error::Any(anyhow!(
                    "No soft delete column found. Expected: deleted_at, is_deleted, or similar"
                )))?
        };

        match &client {
            DatabaseClient::Postgres { client } => {
                maintenance::soft_delete_postgres(
                    client,
                    &table_name,
                    schema_name.as_deref(),
                    &primary_key_column,
                    &primary_key_values,
                    &soft_del_col,
                ).await
            }
            DatabaseClient::SQLite { connection } => {
                let conn = connection.lock().unwrap();
                maintenance::soft_delete_sqlite(
                    &conn,
                    &table_name,
                    &primary_key_column,
                    &primary_key_values,
                    &soft_del_col,
                )
            }
            DatabaseClient::LibSQL { .. } => {
                Err(Error::Any(anyhow!("Soft delete not yet implemented for LibSQL")))
            }
        }
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
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let affected = match &client {
            DatabaseClient::Postgres { client } => {
                maintenance::undo_soft_delete_postgres(
                    client,
                    &table_name,
                    schema_name.as_deref(),
                    &primary_key_column,
                    &primary_key_values,
                    &soft_delete_column,
                ).await?
            }
            _ => {
                return Err(Error::Any(anyhow!("Undo soft delete not implemented for this database type")));
            }
        };

        Ok(MutationResult {
            success: affected > 0,
            affected_rows: affected,
            message: Some(format!("Restored {} row(s)", affected)),
        })
    }

    pub async fn truncate_table(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let result = match &client {
            DatabaseClient::Postgres { client } => {
                maintenance::truncate_table_postgres(
                    client,
                    &table_name,
                    schema_name.as_deref(),
                    cascade.unwrap_or(false),
                ).await?
            }
            DatabaseClient::SQLite { connection } => {
                let conn = connection.lock().unwrap();
                maintenance::truncate_table_sqlite(&conn, &table_name)?
            }
            DatabaseClient::LibSQL { .. } => {
                return Err(Error::Any(anyhow!("Truncate not yet implemented for LibSQL")));
            }
        };

        self.schemas.remove(&connection_id);

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

        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let result = match &client {
            DatabaseClient::Postgres { client } => {
                maintenance::truncate_database_postgres(
                    client,
                    schema_name.as_deref(),
                    confirm,
                ).await?
            }
            _ => {
                return Err(Error::Any(anyhow!(
                    "Truncate database not implemented for this database type"
                )));
            }
        };

        self.schemas.remove(&connection_id);

        Ok(result)
    }

    pub async fn dump_database(
        &self,
        connection_id: Uuid,
        output_path: String,
    ) -> Result<DumpResult, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        let metadata_svc = MetadataService {
            connections: self.connections,
            schemas: self.schemas,
        };
        let schema = metadata_svc.get_database_schema(connection_id).await?;

        match &client {
            DatabaseClient::Postgres { client } => {
                maintenance::dump_database_postgres(
                    client,
                    &schema,
                    &output_path,
                ).await
            }
            DatabaseClient::SQLite { connection } => {
                let conn = connection.lock().unwrap();
                maintenance::dump_database_sqlite(&conn, &output_path)
            }
            DatabaseClient::LibSQL { .. } => {
                Err(Error::Any(anyhow!("Dump not yet implemented for LibSQL")))
            }
        }
    }

    pub async fn execute_batch(
        &self,
        connection_id: Uuid,
        statements: Vec<String>,
    ) -> Result<MutationResult, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();
        let client = connection.get_client()?;

        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        let mut affected_rows = 0;

        match &client {
            DatabaseClient::Postgres { client } => {
                 // Use explicit BEGIN/COMMIT since Arc<Client> doesn't support transaction()
                 client.execute("BEGIN", &[]).await?;
                 let result: Result<(), Error> = async {
                     for stmt in &statements {
                         let rows = client.execute(stmt.as_str(), &[]).await?;
                         affected_rows += rows as usize;
                     }
                     Ok(())
                 }.await;
                 
                 if result.is_ok() {
                     client.execute("COMMIT", &[]).await?;
                 } else {
                     let _ = client.execute("ROLLBACK", &[]).await;
                     result?;
                 }
            }
            DatabaseClient::SQLite { connection } => {
                let mut conn = connection.lock().unwrap();
                let tx = conn.transaction()?;
                for stmt in &statements {
                    let rows = tx.execute(stmt.as_str(), [])?;
                    affected_rows += rows;
                }
                tx.commit()?;
            }
            DatabaseClient::LibSQL { connection } => {
                for stmt in &statements {
                    let res = connection.execute(stmt, ()).await
                        .map_err(|e| Error::Any(anyhow!("LibSQL execution failed: {}", e)))?;
                    affected_rows += res as usize;
                }
            }
        };

        self.schemas.remove(&connection_id);

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}

// Helpers
async fn execute_postgres_update(
    client: &DatabaseClient,
    query: &str,
    new_value: &serde_json::Value,
    pk_value: &serde_json::Value,
) -> Result<usize, Error> {
    if let DatabaseClient::Postgres { client } = client {
        let new_val_param = json_to_pg_param(new_value);
        let pk_param = json_to_pg_param(pk_value);

        let result = client
            .execute(query, &[new_val_param.as_ref(), pk_param.as_ref()])
            .await?;
        Ok(result as usize)
    } else {
        Err(Error::Any(anyhow!("Expected Postgres client")))
    }
}

fn execute_sqlite_update(
    client: &DatabaseClient,
    query: &str,
    new_value: &serde_json::Value,
    pk_value: &serde_json::Value,
) -> Result<usize, Error> {
    if let DatabaseClient::SQLite { connection } = client {
        let conn = connection.lock().unwrap();
        let new_val = json_to_sqlite_value(new_value);
        let pk_val = json_to_sqlite_value(pk_value);

        let result = conn.execute(
            query,
            [
                &new_val as &dyn rusqlite::ToSql,
                &pk_val as &dyn rusqlite::ToSql,
            ],
        )?;
        Ok(result)
    } else {
        Err(Error::Any(anyhow!("Expected SQLite client")))
    }
}

async fn execute_libsql_update(
    client: &DatabaseClient,
    query: &str,
    new_value: &serde_json::Value,
    pk_value: &serde_json::Value,
) -> Result<usize, Error> {
    if let DatabaseClient::LibSQL { connection } = client {
        let new_val = json_to_libsql_value(new_value);
        let pk_val = json_to_libsql_value(pk_value);

        let result = connection
            .execute(query, vec![new_val, pk_val])
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL update failed: {}", e)))?;
        Ok(result as usize)
    } else {
        Err(Error::Any(anyhow!("Expected LibSQL client")))
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

fn json_to_libsql_value(value: &serde_json::Value) -> libsql::Value {
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

fn json_to_sql_literal(value: &serde_json::Value) -> String {
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
        let conn = connection.lock().unwrap();
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

fn pg_value_to_json(row: &tokio_postgres::Row, idx: usize) -> serde_json::Value {
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

fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
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

fn libsql_value_to_json(row: &libsql::Row, idx: i32) -> serde_json::Value {
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

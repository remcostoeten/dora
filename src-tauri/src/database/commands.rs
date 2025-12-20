use std::{
    sync::{Arc, Mutex},
    time::Instant,
};

use anyhow::Context;
use serde_json::value::RawValue;
use uuid::Uuid;

use crate::{
    credentials,
    database::{
        postgres::{self, connect::connect},
        sqlite,
        types::{
            ConnectionInfo, Database, DatabaseConnection, DatabaseInfo, DatabaseSchema,
            QueryStatus, StatementInfo,
        },
        Certificates, ConnectionMonitor,
    },
    error::Error,
    storage::{QueryHistoryEntry, SavedQuery},
    AppState,
};

#[tauri::command]
pub async fn add_connection(
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let id = Uuid::new_v4();

    let (database_info, password) = credentials::extract_sensitive_data(database_info)?;

    // It's expected that add_connection receives database_info with the password included,
    // as checked by the form in the UI. This call saves it in the keyring.
    if let Some(password) = password {
        credentials::store_sensitive_data(&id, &password)?;
    }

    let connection = DatabaseConnection::new(id, name, database_info);
    let mut info = connection.to_connection_info();

    // Set color if provided
    if let Some(color_hue) = color {
        info.color = Some(color_hue.to_string());
    }

    state.storage.save_connection(&info)?;
    state.connections.insert(id, connection);

    Ok(info)
}

#[tauri::command]
pub async fn update_connection(
    conn_id: Uuid,
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let (database_info, password) = credentials::extract_sensitive_data(database_info)?;
    if let Some(password) = password {
        credentials::store_sensitive_data(&conn_id, &password)?;
    }

    if let Some(mut connection_entry) = state.connections.get_mut(&conn_id) {
        let connection = connection_entry.value_mut();

        let config_changed = match (&connection.database, &database_info) {
            (
                Database::Postgres {
                    connection_string: old,
                    ..
                },
                DatabaseInfo::Postgres {
                    connection_string: new,
                },
            ) => old != new,
            (Database::SQLite { db_path: old, .. }, DatabaseInfo::SQLite { db_path: new }) => {
                old != new
            }
            _ => true,
        };

        if config_changed {
            match &mut connection.database {
                Database::Postgres { client, .. } => *client = None,
                Database::SQLite {
                    connection: conn, ..
                } => *conn = None,
            }
            connection.connected = false;
        }

        connection.name = name;
        connection.database = match database_info {
            DatabaseInfo::Postgres { connection_string } => Database::Postgres {
                connection_string,
                client: None,
            },
            DatabaseInfo::SQLite { db_path } => Database::SQLite {
                db_path,
                connection: None,
            },
        };
    }

    let mut updated_info = state
        .connections
        .get(&conn_id)
        .map(|conn| conn.to_connection_info())
        .with_context(|| format!("Connection not found: {}", conn_id))?;

    // Update color if provided
    if let Some(color_hue) = color {
        updated_info.color = Some(color_hue.to_string());
    }

    state.storage.update_connection(&updated_info)?;

    Ok(updated_info)
}

#[tauri::command]
pub async fn update_connection_color(
    connection_id: Uuid,
    color: Option<i32>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let mut connection_info = state
        .storage
        .get_connection(&connection_id)?
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    // Update color
    connection_info.color = color.map(|c| c.to_string());

    state.storage.update_connection(&connection_info)?;

    // Update in-memory connection if it exists
    if let Some(mut connection_entry) = state.connections.get_mut(&connection_id) {
        let connection = connection_entry.value_mut();
        connection.name = connection_info.name.clone();
    }

    Ok(())
}

#[tauri::command]
pub async fn connect_to_database(
    connection_id: Uuid,
    state: tauri::State<'_, AppState>,
    monitor: tauri::State<'_, ConnectionMonitor>,
    certificates: tauri::State<'_, Certificates>,
) -> Result<bool, Error> {
    if !state.connections.contains_key(&connection_id) {
        let stored_connections = state.storage.get_connections()?;
        if let Some(stored_connection) = stored_connections.iter().find(|c| c.id == connection_id) {
            let connection = DatabaseConnection::new(
                stored_connection.id,
                stored_connection.name.clone(),
                stored_connection.database_type.clone(),
            );
            state.connections.insert(connection_id, connection);
        }
    }

    let mut connection_entry = state
        .connections
        .get_mut(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value_mut();

    match &mut connection.database {
        Database::Postgres {
            connection_string,
            client,
        } => {
            // Strip unsupported channel_binding parameter
            let cleaned_string = if let Ok(mut url) = url::Url::parse(&*connection_string) {
                let params: Vec<_> = url
                    .query_pairs()
                    .filter(|(k, _)| k != "channel_binding")
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect();

                let query_string = params.join("&");
                url.set_query(if params.is_empty() {
                    None
                } else {
                    Some(&query_string)
                });
                url.to_string()
            } else {
                connection_string.clone()
            };

            let mut config: tokio_postgres::Config = cleaned_string.parse().with_context(|| {
                format!("Failed to parse connection string: {}", cleaned_string)
            })?;
            if config.get_password().is_none() {
                credentials::get_password(&connection_id)?.map(|pw| config.password(pw));
            }

            match connect(&config, &certificates).await {
                Ok((pg_client, conn_check)) => {
                    *client = Some(Arc::new(pg_client));
                    connection.connected = true;

                    if let Err(e) = state.storage.update_last_connected(&connection_id) {
                        log::warn!("Failed to update last connected timestamp: {}", e);
                    }

                    monitor.add_connection(connection_id, conn_check).await;

                    Ok(true)
                }
                Err(e) => {
                    log::error!("Failed to connect to Postgres: {}", e);
                    connection.connected = false;
                    Ok(false)
                }
            }
        }
        Database::SQLite {
            db_path,
            connection: sqlite_conn,
        } => match rusqlite::Connection::open(&db_path) {
            Ok(conn) => {
                *sqlite_conn = Some(Arc::new(Mutex::new(conn)));
                connection.connected = true;

                if let Err(e) = state.storage.update_last_connected(&connection_id) {
                    log::warn!("Failed to update last connected timestamp: {}", e);
                }

                log::info!("Successfully connected to SQLite database: {}", db_path);
                Ok(true)
            }
            Err(e) => {
                log::error!("Failed to connect to SQLite database {}: {}", db_path, e);
                connection.connected = false;
                Ok(false)
            }
        },
    }
}

#[tauri::command]
pub async fn disconnect_from_database(
    connection_id: Uuid,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let mut connection_entry = state
        .connections
        .get_mut(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;
    let connection = connection_entry.value_mut();

    match &mut connection.database {
        Database::Postgres { client, .. } => *client = None,
        Database::SQLite {
            connection: sqlite_conn,
            ..
        } => *sqlite_conn = None,
    }
    connection.connected = false;
    Ok(())
}

#[tauri::command]
pub async fn start_query(
    connection_id: Uuid,
    query: &str,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<usize>, Error> {
    let connection_entry = state
        .connections
        .get(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value();

    let client = connection.get_client()?;
    let query_ids = state.stmt_manager.submit_query(client, query)?;

    Ok(query_ids)
}

#[tauri::command]
pub async fn fetch_query(
    query_id: usize,
    state: tauri::State<'_, AppState>,
) -> Result<StatementInfo, Error> {
    state.stmt_manager.fetch_query(query_id)
}

#[tauri::command]
pub async fn fetch_page(
    query_id: usize,
    page_index: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Box<RawValue>>, Error> {
    let now = Instant::now();
    let page = state.stmt_manager.fetch_page(query_id, page_index)?;
    let elapsed = now.elapsed();
    log::info!("Took {}us to get page {page_index}", elapsed.as_micros());

    Ok(page)
}

#[tauri::command]
pub async fn get_query_status(
    query_id: usize,
    state: tauri::State<'_, AppState>,
) -> Result<QueryStatus, Error> {
    state.stmt_manager.get_query_status(query_id)
}

#[tauri::command]
pub async fn get_page_count(
    query_id: usize,
    state: tauri::State<'_, AppState>,
) -> Result<usize, Error> {
    state.stmt_manager.get_page_count(query_id)
}

#[tauri::command]
pub async fn get_columns(
    query_id: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Option<Box<RawValue>>, Error> {
    state.stmt_manager.get_columns(query_id)
}

#[tauri::command]
pub async fn get_connections(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ConnectionInfo>, Error> {
    let mut stored_connections = state.storage.get_connections()?;

    for connection in &mut stored_connections {
        if let Some(runtime_connection) = state.connections.get(&connection.id) {
            connection.connected = runtime_connection.connected;
        } else {
            connection.connected = false;
        }
    }

    Ok(stored_connections)
}

#[tauri::command]
pub async fn remove_connection(
    connection_id: Uuid,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    if let Err(e) = credentials::delete_password(&connection_id) {
        log::debug!(
            "Could not delete password from keyring (may not exist): {}",
            e
        );
    }

    state.storage.remove_connection(&connection_id)?;
    state.connections.remove(&connection_id);

    Ok(())
}

#[tauri::command]
pub async fn test_connection(
    // It's expected that test_connection receives database_info with the password included
    database_info: DatabaseInfo,
    certificates: tauri::State<'_, Certificates>,
) -> Result<bool, Error> {
    match database_info {
        DatabaseInfo::Postgres { connection_string } => {
            // Strip unsupported channel_binding parameter
            let cleaned_string = if let Ok(mut url) = url::Url::parse(&connection_string) {
                let params: Vec<_> = url
                    .query_pairs()
                    .filter(|(k, _)| k != "channel_binding")
                    .map(|(k, v)| format!("{}={}", k, v))
                    .collect();

                let query_string = params.join("&");
                url.set_query(if params.is_empty() {
                    None
                } else {
                    Some(&query_string)
                });
                url.to_string()
            } else {
                connection_string.clone()
            };

            let config: tokio_postgres::Config = cleaned_string.parse().with_context(|| {
                format!("Failed to parse connection string: {}", cleaned_string)
            })?;
            log::info!("Testing Postgres connection: {config:?}");
            match connect(&config, &certificates).await {
                Ok(_) => Ok(true),
                Err(e) => {
                    log::error!("Postgres connection test failed: {}", e);
                    Err(Error::from(e))
                }
            }
        }
        DatabaseInfo::SQLite { db_path } => match rusqlite::Connection::open(db_path) {
            Ok(_) => Ok(true),
            Err(e) => {
                log::error!("SQLite connection test failed: {}", e);
                Err(Error::from(e))
            }
        },
    }
}

#[tauri::command]
pub async fn save_query_to_history(
    connection_id: String,
    query: String,
    duration_ms: Option<u64>,
    status: String,
    row_count: u64,
    error_message: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let entry = QueryHistoryEntry {
        id: 0, // Sqlite will assign,
        connection_id,
        query_text: query,
        executed_at: chrono::Utc::now().timestamp(),
        duration_ms: duration_ms.map(|d| d as i64),
        status,
        row_count: row_count as i64,
        error_message,
    };

    state.storage.save_query_history(&entry)?;
    Ok(())
}

#[tauri::command]
pub async fn get_query_history(
    connection_id: String,
    limit: Option<u32>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, Error> {
    state
        .storage
        .get_query_history(&connection_id, limit.map(|l| l as i64))
}

#[tauri::command]
pub async fn initialize_connections(state: tauri::State<'_, AppState>) -> Result<(), Error> {
    let stored_connections = state.storage.get_connections()?;

    for stored_connection in stored_connections {
        let connection = DatabaseConnection::new(
            stored_connection.id,
            stored_connection.name,
            stored_connection.database_type,
        );
        state.connections.insert(connection.id, connection);
    }

    log::info!(
        "Initialized {} connections from storage",
        state.connections.len()
    );
    Ok(())
}

#[tauri::command]
pub async fn get_database_schema(
    connection_id: Uuid,
    state: tauri::State<'_, AppState>,
) -> Result<Arc<DatabaseSchema>, Error> {
    if let Some(schema) = state.schemas.get(&connection_id) {
        return Ok(schema.clone());
    }

    let connection_entry = state
        .connections
        .get(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value();

    let schema = match &connection.database {
        Database::Postgres {
            client: Some(client),
            ..
        } => postgres::schema::get_database_schema(client).await?,
        Database::Postgres { client: None, .. } => {
            return Err(Error::Any(anyhow::anyhow!(
                "Postgres connection not active"
            )))
        }
        Database::SQLite {
            connection: Some(conn),
            ..
        } => sqlite::schema::get_database_schema(Arc::clone(conn)).await?,
        Database::SQLite {
            connection: None, ..
        } => return Err(Error::Any(anyhow::anyhow!("SQLite connection not active"))),
    };

    let schema = Arc::new(schema);
    state.schemas.insert(connection_id, schema.clone());

    Ok(schema)
}

// Script management commands
#[tauri::command]
pub async fn save_script(
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<i64, Error> {
    let script = SavedQuery {
        id: 0, // New script
        name,
        description,
        query_text: content,
        connection_id,
        tags: None,
        created_at: 0, // Will be set by storage
        updated_at: 0, // Will be set by storage
        favorite: false,
    };

    let script_id = state.storage.save_query(&script)?;
    Ok(script_id)
}

#[tauri::command]
pub async fn update_script(
    id: i64,
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    let script = SavedQuery {
        id,
        name,
        description,
        query_text: content,
        connection_id,
        tags: None,
        created_at: 0, // Will be ignored for updates
        updated_at: 0, // Will be set by storage
        favorite: false,
    };

    state.storage.save_query(&script)?;
    Ok(())
}

#[tauri::command]
pub async fn get_scripts(
    connection_id: Option<Uuid>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let scripts = state.storage.get_saved_queries(connection_id.as_ref())?;
    Ok(scripts)
}

#[tauri::command]
pub async fn delete_script(id: i64, state: tauri::State<'_, AppState>) -> Result<(), Error> {
    state.storage.delete_saved_query(id)?;
    Ok(())
}

#[tauri::command]
pub async fn save_session_state(
    session_data: &str,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.set_setting("session_state", session_data)?;
    Ok(())
}

#[tauri::command]
pub async fn get_session_state(state: tauri::State<'_, AppState>) -> Result<Option<String>, Error> {
    let session_data = state.storage.get_setting("session_state")?;
    Ok(session_data)
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, Error> {
    let value = state.storage.get_setting(&key)?;
    Ok(value)
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.set_setting(&key, &value)?;
    Ok(())
}

#[tauri::command]
pub async fn get_connection_history(
    db_type_filter: Option<String>,
    success_filter: Option<bool>,
    limit: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::storage::ConnectionHistoryEntry>, Error> {
    state
        .storage
        .get_connection_history(db_type_filter.as_deref(), success_filter, limit)
}

// =============================================================================
// Mutation API Commands
// =============================================================================
// These commands provide structured data manipulation for spreadsheet-style UIs

use serde::{Deserialize, Serialize};

/// Export format options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Json,
    SqlInsert,
    Csv,
}

/// Result of a mutation operation
#[derive(Debug, Clone, Serialize)]
pub struct MutationResult {
    pub success: bool,
    pub affected_rows: usize,
    pub message: Option<String>,
}

/// Update a single cell value in a table
#[tauri::command]
pub async fn update_cell(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_value: serde_json::Value,
    column_name: String,
    new_value: serde_json::Value,
    state: tauri::State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let connection_entry = state
        .connections
        .get(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value();
    let client = connection.get_client()?;

    // Build the UPDATE query
    let (query, is_postgres) = match &client {
        crate::database::types::DatabaseClient::Postgres { .. } => {
            let schema_prefix = schema_name
                .as_ref()
                .map(|s| format!("\"{}\".", s))
                .unwrap_or_default();
            let query = format!(
                "UPDATE {}\"{table_name}\" SET \"{column_name}\" = $1 WHERE \"{primary_key_column}\" = $2",
                schema_prefix
            );
            (query, true)
        }
        crate::database::types::DatabaseClient::SQLite { .. } => {
            let query = format!(
                "UPDATE \"{table_name}\" SET \"{column_name}\" = ? WHERE \"{primary_key_column}\" = ?"
            );
            (query, false)
        }
    };

    // Execute the query
    let result = if is_postgres {
        execute_postgres_update(&client, &query, &new_value, &primary_key_value).await?
    } else {
        execute_sqlite_update(&client, &query, &new_value, &primary_key_value)?
    };

    // Invalidate cached schema as data changed
    state.schemas.remove(&connection_id);

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

/// Delete one or more rows from a table
#[tauri::command]
pub async fn delete_rows(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    state: tauri::State<'_, AppState>,
) -> Result<MutationResult, Error> {
    if primary_key_values.is_empty() {
        return Ok(MutationResult {
            success: true,
            affected_rows: 0,
            message: Some("No rows to delete".to_string()),
        });
    }

    let connection_entry = state
        .connections
        .get(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value();
    let client = connection.get_client()?;

    let total_deleted = match &client {
        crate::database::types::DatabaseClient::Postgres { client } => {
            let schema_prefix = schema_name
                .as_ref()
                .map(|s| format!("\"{}\".", s))
                .unwrap_or_default();

            // Build IN clause with parameters
            let placeholders: Vec<String> = (1..=primary_key_values.len())
                .map(|i| format!("${}", i))
                .collect();
            let query = format!(
                "DELETE FROM {}\"{table_name}\" WHERE \"{primary_key_column}\" IN ({})",
                schema_prefix,
                placeholders.join(", ")
            );

            // Convert values to params
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
        crate::database::types::DatabaseClient::SQLite { connection } => {
            let conn = connection.lock().unwrap();

            // Build IN clause with placeholders
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
    };

    // Invalidate cached schema
    state.schemas.remove(&connection_id);

    Ok(MutationResult {
        success: total_deleted > 0,
        affected_rows: total_deleted,
        message: Some(format!("Deleted {} row(s)", total_deleted)),
    })
}

/// Export table data to a specific format
#[tauri::command]
pub async fn export_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    format: ExportFormat,
    limit: Option<u32>,
    state: tauri::State<'_, AppState>,
) -> Result<String, Error> {
    let connection_entry = state
        .connections
        .get(&connection_id)
        .with_context(|| format!("Connection not found: {}", connection_id))?;

    let connection = connection_entry.value();
    let client = connection.get_client()?;

    // Build SELECT query
    let (query, is_postgres) = match &client {
        crate::database::types::DatabaseClient::Postgres { .. } => {
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
                true,
            )
        }
        crate::database::types::DatabaseClient::SQLite { .. } => {
            let limit_clause = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
            (
                format!("SELECT * FROM \"{}\"{}", table_name, limit_clause),
                false,
            )
        }
    };

    // Execute and get results
    let (columns, rows) = if is_postgres {
        fetch_postgres_data(&client, &query).await?
    } else {
        fetch_sqlite_data(&client, &query)?
    };

    // Format output
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

// =============================================================================
// Helper functions for mutation commands
// =============================================================================

async fn execute_postgres_update(
    client: &crate::database::types::DatabaseClient,
    query: &str,
    new_value: &serde_json::Value,
    pk_value: &serde_json::Value,
) -> Result<usize, Error> {
    if let crate::database::types::DatabaseClient::Postgres { client } = client {
        let new_val_param = json_to_pg_param(new_value);
        let pk_param = json_to_pg_param(pk_value);

        let result = client
            .execute(query, &[new_val_param.as_ref(), pk_param.as_ref()])
            .await?;
        Ok(result as usize)
    } else {
        Err(Error::Any(anyhow::anyhow!("Expected Postgres client")))
    }
}

fn execute_sqlite_update(
    client: &crate::database::types::DatabaseClient,
    query: &str,
    new_value: &serde_json::Value,
    pk_value: &serde_json::Value,
) -> Result<usize, Error> {
    if let crate::database::types::DatabaseClient::SQLite { connection } = client {
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
        Err(Error::Any(anyhow::anyhow!("Expected SQLite client")))
    }
}

async fn fetch_postgres_data(
    client: &crate::database::types::DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let crate::database::types::DatabaseClient::Postgres { client } = client {
        let rows = client.query(query, &[]).await?;

        if rows.is_empty() {
            return Ok((vec![], vec![]));
        }

        let columns: Vec<String> = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect();

        let mut data = Vec::new();
        for row in &rows {
            let mut row_data = Vec::new();
            for (i, col) in row.columns().iter().enumerate() {
                let value = pg_value_to_json(&row, i, col.type_())?;
                row_data.push(value);
            }
            data.push(row_data);
        }

        Ok((columns, data))
    } else {
        Err(Error::Any(anyhow::anyhow!("Expected Postgres client")))
    }
}

fn fetch_sqlite_data(
    client: &crate::database::types::DatabaseClient,
    query: &str,
) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
    if let crate::database::types::DatabaseClient::SQLite { connection } = client {
        let conn = connection.lock().unwrap();
        let mut stmt = conn.prepare(query)?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let rows: Vec<Vec<serde_json::Value>> = stmt
            .query_map([], |row| {
                let mut row_data = Vec::new();
                for i in 0..columns.len() {
                    let value = sqlite_value_to_json(row, i);
                    row_data.push(value);
                }
                Ok(row_data)
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok((columns, rows))
    } else {
        Err(Error::Any(anyhow::anyhow!("Expected SQLite client")))
    }
}

fn json_to_pg_param(
    value: &serde_json::Value,
) -> Box<dyn tokio_postgres::types::ToSql + Sync + Send> {
    match value {
        serde_json::Value::Null => Box::new(None::<String>),
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
        other => Box::new(other.to_string()),
    }
}

fn json_to_sqlite_value(value: &serde_json::Value) -> rusqlite::types::Value {
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
        other => rusqlite::types::Value::Text(other.to_string()),
    }
}

fn json_to_sql_literal(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
        other => format!("'{}'", other.to_string().replace("'", "''")),
    }
}

fn pg_value_to_json(
    row: &tokio_postgres::Row,
    idx: usize,
    _type_: &tokio_postgres::types::Type,
) -> Result<serde_json::Value, Error> {
    // Try to get as different types, falling back as needed
    if let Ok(v) = row.try_get::<_, Option<i64>>(idx) {
        return Ok(v
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null));
    }
    if let Ok(v) = row.try_get::<_, Option<f64>>(idx) {
        return Ok(v
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null));
    }
    if let Ok(v) = row.try_get::<_, Option<bool>>(idx) {
        return Ok(v
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null));
    }
    if let Ok(v) = row.try_get::<_, Option<String>>(idx) {
        return Ok(v
            .map(serde_json::Value::from)
            .unwrap_or(serde_json::Value::Null));
    }
    // Default to string representation
    Ok(serde_json::Value::Null)
}

fn sqlite_value_to_json(row: &rusqlite::Row, idx: usize) -> serde_json::Value {
    use base64::Engine;
    use rusqlite::types::ValueRef;

    match row.get_ref(idx) {
        Ok(ValueRef::Null) => serde_json::Value::Null,
        Ok(ValueRef::Integer(i)) => serde_json::Value::from(i),
        Ok(ValueRef::Real(f)) => serde_json::Value::from(f),
        Ok(ValueRef::Text(t)) => serde_json::Value::from(String::from_utf8_lossy(t).to_string()),
        Ok(ValueRef::Blob(b)) => {
            serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(b))
        }
        Err(_) => serde_json::Value::Null,
    }
}

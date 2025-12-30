use std::sync::Arc;
use uuid::Uuid;
use tauri::State;
use serde_json::value::RawValue;

use crate::{
    database::{
        services::{
            connection::ConnectionService,
            query::QueryService,
            mutation::MutationService,
            metadata::MetadataService,
        },
        types::{
            ConnectionInfo, DatabaseInfo, StatementInfo, QueryStatus,
            DatabaseSchema,
        },
        maintenance::{SoftDeleteResult, TruncateResult, DumpResult},
    },
    error::Error,
    AppState,
    storage::{QueryHistoryEntry, SavedQuery, ConnectionHistoryEntry},
};

// Re-exports for compatibility and accessibility
pub use crate::database::services::mutation::{ExportFormat, MutationResult};
pub use crate::database::metadata::DatabaseMetadata;

// Re-export helpers for maintenance.rs
pub use crate::database::services::mutation::{json_to_pg_param, json_to_sqlite_value};

// =============================================================================
// Connection Commands
// =============================================================================

#[tauri::command]
pub async fn add_connection(
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.add_connection(name, database_info, color).await
}

#[tauri::command]
pub async fn update_connection(
    conn_id: Uuid,
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.update_connection(conn_id, name, database_info, color).await
}

#[tauri::command]
pub async fn update_connection_color(
    connection_id: Uuid,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.update_connection_color(connection_id, color).await
}

#[tauri::command]
pub async fn connect_to_database(
    connection_id: Uuid,
    state: State<'_, AppState>,
    monitor: State<'_, crate::database::ConnectionMonitor>,
    certificates: State<'_, crate::database::Certificates>,
) -> Result<bool, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.connect_to_database(&monitor, &certificates, connection_id).await
}

#[tauri::command]
pub async fn disconnect_from_database(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.disconnect_from_database(connection_id).await
}

#[tauri::command]
pub async fn get_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionInfo>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.get_connections().await
}

#[tauri::command]
pub async fn remove_connection(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.remove_connection(connection_id).await
}

#[tauri::command]
pub async fn test_connection(
    database_info: DatabaseInfo,
    certificates: State<'_, crate::database::Certificates>,
) -> Result<bool, Error> {
    ConnectionService::test_connection(database_info, &certificates).await
}

#[tauri::command]
pub async fn initialize_connections(state: State<'_, AppState>) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.initialize_connections().await
}

#[tauri::command]
pub async fn get_recent_connections(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionInfo>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.get_recent_connections(limit).await
}

#[tauri::command]
pub async fn get_connection_history(
    db_type_filter: Option<String>,
    success_filter: Option<bool>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_connection_history(db_type_filter, success_filter, limit).await
}


// =============================================================================
// Query Commands
// =============================================================================

#[tauri::command]
pub async fn start_query(
    connection_id: Uuid,
    query: &str,
    state: State<'_, AppState>,
) -> Result<Vec<usize>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.start_query(connection_id, query).await
}

#[tauri::command]
pub async fn fetch_query(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<StatementInfo, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.fetch_query(query_id).await
}

#[tauri::command]
pub async fn fetch_page(
    query_id: usize,
    page_index: usize,
    state: State<'_, AppState>,
) -> Result<Option<Box<RawValue>>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.fetch_page(query_id, page_index).await
}

#[tauri::command]
pub async fn get_query_status(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<QueryStatus, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_query_status(query_id).await
}

#[tauri::command]
pub async fn get_page_count(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<usize, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_page_count(query_id).await
}

#[tauri::command]
pub async fn get_columns(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<Option<Box<RawValue>>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_columns(query_id).await
}

#[tauri::command]
pub async fn save_query_to_history(
    connection_id: String,
    query: String,
    duration_ms: Option<u64>,
    status: String,
    row_count: u64,
    error_message: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_query_to_history(connection_id, query, duration_ms, status, row_count, error_message).await
}

#[tauri::command]
pub async fn get_query_history(
    connection_id: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_query_history(connection_id, limit).await
}

#[tauri::command]
pub async fn get_recent_queries(
    connection_id: Option<String>,
    limit: Option<u32>,
    status_filter: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_recent_queries(connection_id, limit, status_filter).await
}


// =============================================================================
// Script Commands
// =============================================================================

#[tauri::command]
pub async fn save_script(
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_script(name, content, connection_id, description).await
}

#[tauri::command]
pub async fn update_script(
    id: i64,
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.update_script(id, name, content, connection_id, description).await
}

#[tauri::command]
pub async fn get_scripts(
    connection_id: Option<Uuid>,
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_scripts(connection_id).await
}

#[tauri::command]
pub async fn delete_script(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.delete_script(id).await
}


// =============================================================================
// Setting / Session Commands
// =============================================================================

#[tauri::command]
pub async fn save_session_state(
    session_data: &str,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_session_state(session_data).await
}

#[tauri::command]
pub async fn get_session_state(state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_session_state().await
}

#[tauri::command]
pub async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_setting(key).await
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.set_setting(key, value).await
}


// =============================================================================
// Mutation Commands
// =============================================================================

#[tauri::command]
pub async fn insert_row(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    row_data: serde_json::Map<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.insert_row(connection_id, table_name, schema_name, row_data).await
}

#[tauri::command]
pub async fn update_cell(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_value: serde_json::Value,
    column_name: String,
    new_value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.update_cell(connection_id, table_name, schema_name, primary_key_column, primary_key_value, column_name, new_value).await
}

#[tauri::command]
pub async fn delete_rows(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.delete_rows(connection_id, table_name, schema_name, primary_key_column, primary_key_values).await
}

#[tauri::command]
pub async fn export_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    format: ExportFormat,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<String, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.export_table(connection_id, table_name, schema_name, format, limit).await
}

#[tauri::command]
pub async fn soft_delete_rows(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    soft_delete_column: Option<String>,
    state: State<'_, AppState>,
) -> Result<SoftDeleteResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.soft_delete_rows(connection_id, table_name, schema_name, primary_key_column, primary_key_values, soft_delete_column).await
}

#[tauri::command]
pub async fn undo_soft_delete(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    soft_delete_column: String,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.undo_soft_delete(connection_id, table_name, schema_name, primary_key_column, primary_key_values, soft_delete_column).await
}

#[tauri::command]
pub async fn truncate_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    cascade: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TruncateResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.truncate_table(connection_id, table_name, schema_name, cascade).await
}

#[tauri::command]
pub async fn truncate_database(
    connection_id: Uuid,
    schema_name: Option<String>,
    confirm: bool,
    state: State<'_, AppState>,
) -> Result<TruncateResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.truncate_database(connection_id, schema_name, confirm).await
}

#[tauri::command]
pub async fn dump_database(
    connection_id: Uuid,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<DumpResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.dump_database(connection_id, output_path).await
}

#[tauri::command]
pub async fn execute_batch(
    connection_id: Uuid,
    statements: Vec<String>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.execute_batch(connection_id, statements).await
}


// =============================================================================
// Metadata Commands
// =============================================================================

#[tauri::command]
pub async fn get_database_schema(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<Arc<DatabaseSchema>, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.get_database_schema(connection_id).await
}

#[tauri::command]
pub async fn get_database_metadata(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<DatabaseMetadata, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.get_database_metadata(connection_id).await
}

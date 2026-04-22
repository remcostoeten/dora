use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        services::query::QueryService,
        types::{QueryStatus, StatementInfo},
    },
    error::Error,
    storage::QueryHistoryEntry,
    AppState,
};

#[tauri::command]
#[specta::specta]
pub async fn start_query(
    connection_id: Uuid,
    query: &str,
    state: State<'_, AppState>,
) -> Result<Vec<usize>, Error> {
    // SQL Console uses `start_query`; invalidate cached schema when query includes
    // non-read-only statements so schema fetches reflect DDL changes immediately.
    let invalidates_schema = {
        let parsed = state.connections.get(&connection_id).and_then(|connection_entry| {
            let connection = connection_entry.value();
            match &connection.database {
                crate::database::types::Database::Postgres { .. } => {
                    crate::database::postgres::parser::parse_statements(query).ok()
                }
                crate::database::types::Database::SQLite { .. } => {
                    crate::database::sqlite::parser::parse_statements(query).ok()
                }
                crate::database::types::Database::LibSQL { .. } => {
                    crate::database::libsql::parser::parse_statements(query).ok()
                }
                crate::database::types::Database::MySQL { .. } => {
                    crate::database::mysql::parser::parse_statements(query).ok()
                }
            }
        });

        if let Some(statements) = parsed {
            statements.iter().any(|stmt| !stmt.is_read_only)
        } else {
            // Fallback for parser edge-cases: prefer cache invalidation over stale schema.
            let upper = query.to_ascii_uppercase();
            ["CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME", "ATTACH", "DETACH"]
                .iter()
                .any(|keyword| upper.contains(keyword))
        }
    };

    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    let query_ids = svc.start_query(connection_id, query).await?;

    if invalidates_schema {
        state.schemas.remove(&connection_id);
    }

    Ok(query_ids)
}

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
pub async fn fetch_page(
    query_id: usize,
    page_index: usize,
    state: State<'_, AppState>,
) -> Result<Option<serde_json::Value>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    let raw = svc.fetch_page(query_id, page_index).await?;
    Ok(raw.map(|r| serde_json::from_str(r.get()).unwrap_or(serde_json::Value::Null)))
}

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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
#[specta::specta]
pub async fn get_columns(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<Option<serde_json::Value>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    let raw = svc.get_columns(query_id).await?;
    Ok(raw.map(|r| serde_json::from_str(r.get()).unwrap_or(serde_json::Value::Null)))
}

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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
#[specta::specta]
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

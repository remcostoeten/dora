use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        services::{connection::ConnectionService, query::QueryService},
        types::{ConnectionInfo, DatabaseInfo},
    },
    error::Error,
    storage::ConnectionHistoryEntry,
    AppState,
};

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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
#[specta::specta]
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
#[specta::specta]
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
#[specta::specta]
pub async fn disconnect_from_database(
    connection_id: Uuid,
    state: State<'_, AppState>,
    live_monitor: State<'_, crate::database::LiveMonitorManager>,
) -> Result<(), Error> {
    live_monitor.stop_monitors_for_connection(connection_id);

    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.disconnect_from_database(connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionInfo>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.get_connections().await
}

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
pub async fn test_connection(
    database_info: DatabaseInfo,
    certificates: State<'_, crate::database::Certificates>,
) -> Result<bool, Error> {
    ConnectionService::test_connection(database_info, &certificates).await
}

#[tauri::command]
#[specta::specta]
pub async fn initialize_connections(state: State<'_, AppState>) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.initialize_connections().await
}

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
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

#[tauri::command]
#[specta::specta]
pub async fn set_connection_pin(
    connection_id: Uuid,
    pin: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.set_connection_pin(connection_id, pin).await
}

#[tauri::command]
#[specta::specta]
pub async fn verify_pin_and_get_credentials(
    connection_id: Uuid,
    pin: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.verify_pin_and_get_credentials(connection_id, pin).await
}

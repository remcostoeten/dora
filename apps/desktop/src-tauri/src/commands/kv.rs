use std::time::Instant;

use tauri::State;
use uuid::Uuid;

use crate::{
    kv::{
        KvBytes, KvCommandResult, KvConnection, KvConnectionConfig, KvKeyPage, KvMutationResult,
        KvReadRequest, KvReadResult, KvScanRequest,
    },
    storage::{KvCommandHistoryEntry, KvConnectionInfo},
    AppState, Error, Result,
};

fn connected_client(state: &AppState, connection_id: Uuid) -> Result<KvConnection> {
    state
        .kv_connections
        .get(&connection_id)
        .map(|entry| entry.value().clone())
        .ok_or(Error::ConnectionNotFound(connection_id))
}

#[tauri::command]
#[specta::specta]
pub async fn kv_add_connection(
    name: String,
    config: KvConnectionConfig,
    state: State<'_, AppState>,
) -> Result<KvConnectionInfo> {
    if name.trim().is_empty() {
        return Err(Error::InvalidInput(
            "connection name cannot be empty".into(),
        ));
    }
    let client = KvConnection::connect(&config).await?;
    let id = Uuid::new_v4();
    let mut info = KvConnectionInfo {
        id,
        name: name.trim().to_string(),
        config,
        connected: true,
        last_connected_at: Some(chrono::Utc::now().timestamp()),
        favorite: false,
        color: None,
        sort_order: 0,
    };
    state.storage.save_kv_connection(&info)?;
    state.storage.update_kv_last_connected(&id)?;
    state.kv_connections.insert(id, client);
    if let Some(saved) = state.storage.get_kv_connection(&id)? {
        info.sort_order = saved.sort_order;
    }
    Ok(info)
}

#[tauri::command]
#[specta::specta]
pub async fn kv_update_connection(
    connection_id: Uuid,
    name: String,
    config: KvConnectionConfig,
    state: State<'_, AppState>,
) -> Result<KvConnectionInfo> {
    if name.trim().is_empty() {
        return Err(Error::InvalidInput(
            "connection name cannot be empty".into(),
        ));
    }
    let mut current = state
        .storage
        .get_kv_connection(&connection_id)?
        .ok_or(Error::ConnectionNotFound(connection_id))?;
    let client = KvConnection::connect(&config).await?;
    current.name = name.trim().to_string();
    current.config = config;
    current.connected = true;
    current.last_connected_at = Some(chrono::Utc::now().timestamp());
    state.storage.save_kv_connection(&current)?;
    state.storage.update_kv_last_connected(&connection_id)?;
    state.kv_connections.insert(connection_id, client);
    Ok(current)
}

#[tauri::command]
#[specta::specta]
pub async fn kv_test_connection(config: KvConnectionConfig) -> Result<()> {
    KvConnection::connect(&config).await.map(|_| ())
}

#[tauri::command]
#[specta::specta]
pub async fn kv_connect(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<KvConnectionInfo> {
    let mut info = state
        .storage
        .get_kv_connection(&connection_id)?
        .ok_or(Error::ConnectionNotFound(connection_id))?;
    if !state.kv_connections.contains_key(&connection_id) {
        let client = KvConnection::connect(&info.config).await?;
        state.kv_connections.insert(connection_id, client);
    }
    state.storage.update_kv_last_connected(&connection_id)?;
    info.connected = true;
    info.last_connected_at = Some(chrono::Utc::now().timestamp());
    Ok(info)
}

#[tauri::command]
#[specta::specta]
pub fn kv_disconnect(connection_id: Uuid, state: State<'_, AppState>) -> Result<()> {
    state.kv_connections.remove(&connection_id);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn kv_get_connections(state: State<'_, AppState>) -> Result<Vec<KvConnectionInfo>> {
    let mut connections = state.storage.get_kv_connections()?;
    for connection in &mut connections {
        connection.connected = state.kv_connections.contains_key(&connection.id);
    }
    Ok(connections)
}

#[tauri::command]
#[specta::specta]
pub fn kv_remove_connection(connection_id: Uuid, state: State<'_, AppState>) -> Result<()> {
    state.kv_connections.remove(&connection_id);
    state.storage.remove_kv_connection(&connection_id)
}

#[tauri::command]
#[specta::specta]
pub async fn kv_scan(
    connection_id: Uuid,
    request: KvScanRequest,
    state: State<'_, AppState>,
) -> Result<KvKeyPage> {
    connected_client(&state, connection_id)?.scan(request).await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_read(
    connection_id: Uuid,
    request: KvReadRequest,
    state: State<'_, AppState>,
) -> Result<KvReadResult> {
    connected_client(&state, connection_id)?.read(request).await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_delete_key(
    connection_id: Uuid,
    key: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .delete_key(key)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_set_ttl(
    connection_id: Uuid,
    key: KvBytes,
    ttl_ms: Option<u64>,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    let mut client = connected_client(&state, connection_id)?;
    match ttl_ms {
        Some(value) => client.set_ttl_ms(key, value).await,
        None => client.clear_ttl(key).await,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn kv_set_string(
    connection_id: Uuid,
    key: KvBytes,
    value: KvBytes,
    keep_ttl: bool,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .set_string(key, value, keep_ttl)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_hash_set(
    connection_id: Uuid,
    key: KvBytes,
    field: KvBytes,
    value: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .hash_set(key, field, value)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_hash_delete(
    connection_id: Uuid,
    key: KvBytes,
    field: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .hash_delete(key, field)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_list_set(
    connection_id: Uuid,
    key: KvBytes,
    index: i64,
    value: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .list_set(key, index, value)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_list_push(
    connection_id: Uuid,
    key: KvBytes,
    value: KvBytes,
    left: bool,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .list_push(key, value, left)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_list_remove_at(
    connection_id: Uuid,
    key: KvBytes,
    index: i64,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .list_remove_at(key, index)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_set_add(
    connection_id: Uuid,
    key: KvBytes,
    member: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .set_add(key, member)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_set_remove(
    connection_id: Uuid,
    key: KvBytes,
    member: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .set_remove(key, member)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_sorted_set_add(
    connection_id: Uuid,
    key: KvBytes,
    member: KvBytes,
    score: f64,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .sorted_set_add(key, member, score)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_sorted_set_remove(
    connection_id: Uuid,
    key: KvBytes,
    member: KvBytes,
    state: State<'_, AppState>,
) -> Result<KvMutationResult> {
    connected_client(&state, connection_id)?
        .sorted_set_remove(key, member)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn kv_execute_raw(
    connection_id: Uuid,
    command: String,
    confirmation: Option<String>,
    state: State<'_, AppState>,
) -> Result<KvCommandResult> {
    let started = Instant::now();
    let result = connected_client(&state, connection_id)?
        .execute_raw(&command, confirmation.as_deref())
        .await;
    let duration_ms = i64::try_from(started.elapsed().as_millis()).unwrap_or(i64::MAX);
    match &result {
        Ok(_) => state.storage.save_kv_command_history(
            &connection_id,
            &command,
            Some(duration_ms),
            "success",
            None,
        )?,
        Err(error) => state.storage.save_kv_command_history(
            &connection_id,
            &command,
            Some(duration_ms),
            "error",
            Some(&error.to_string()),
        )?,
    }
    result
}

#[tauri::command]
#[specta::specta]
pub fn kv_get_command_history(
    connection_id: Uuid,
    limit: u32,
    state: State<'_, AppState>,
) -> Result<Vec<KvCommandHistoryEntry>> {
    state.storage.get_kv_command_history(&connection_id, limit)
}

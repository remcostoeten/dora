use tauri::State;

use crate::{database::services::query::QueryService, error::Error, AppState};

#[tauri::command]
#[specta::specta]
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
#[specta::specta]
pub async fn get_session_state(state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_session_state().await
}

#[tauri::command]
#[specta::specta]
pub async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_setting(key).await
}

#[tauri::command]
#[specta::specta]
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

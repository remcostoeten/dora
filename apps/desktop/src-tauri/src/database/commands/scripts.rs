use tauri::State;
use uuid::Uuid;

use crate::{database::services::query::QueryService, error::Error, storage::SavedQuery, AppState};

#[tauri::command]
#[specta::specta]
pub async fn save_script(
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    let svc = QueryService {
        connection_repo: state.inner(),
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_script(name, content, connection_id, description)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn update_script(
    id: i64,
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connection_repo: state.inner(),
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.update_script(id, name, content, connection_id, description)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn get_scripts(
    connection_id: Option<Uuid>,
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let svc = QueryService {
        connection_repo: state.inner(),
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_scripts(connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_script(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    let svc = QueryService {
        connection_repo: state.inner(),
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.delete_script(id).await
}

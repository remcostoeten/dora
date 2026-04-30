use tauri::State;

use crate::{error::Error, AppState};

#[tauri::command]
#[specta::specta]
pub async fn get_snippet_folders(
    state: State<'_, AppState>,
) -> Result<Vec<crate::storage::SnippetFolder>, Error> {
    state.storage.get_snippet_folders()
}

#[tauri::command]
#[specta::specta]
pub async fn create_snippet_folder(
    name: String,
    parent_id: Option<i64>,
    color: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    state
        .storage
        .create_snippet_folder(&name, parent_id, color.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn update_snippet_folder(
    id: i64,
    name: String,
    color: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    state
        .storage
        .update_snippet_folder(id, &name, color.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_snippet_folder(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    state.storage.delete_snippet_folder(id)
}

use tauri::State;

use crate::{
    integrations::supabase::{self, SupabaseProject},
    AppState, Error,
};

#[tauri::command]
#[specta::specta]
pub async fn supabase_save_token(
    token: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    supabase::save_token(&state.storage, token).await
}

#[tauri::command]
#[specta::specta]
pub async fn supabase_list_projects(
    state: State<'_, AppState>,
) -> Result<Vec<SupabaseProject>, Error> {
    supabase::list_projects(&state.storage).await
}

#[tauri::command]
#[specta::specta]
pub async fn supabase_disconnect(state: State<'_, AppState>) -> Result<(), Error> {
    supabase::disconnect(&state.storage)
}

#[tauri::command]
#[specta::specta]
pub fn supabase_is_connected(state: State<'_, AppState>) -> bool {
    supabase::is_connected(&state.storage)
}

use tauri::State;
use tauri_plugin_shell::ShellExt;

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

/// One-click OAuth: opens the consent page in the browser and waits for the
/// hosted proxy to redirect tokens back to a local loopback listener.
#[tauri::command]
#[specta::specta]
pub async fn supabase_oauth_connect(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    supabase::oauth_connect(&state.storage, move |url| {
        app.shell()
            .open(url, None)
            .map_err(|error| Error::Any(anyhow::anyhow!("Failed to open browser: {error}")))
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn supabase_list_projects(
    state: State<'_, AppState>,
) -> Result<Vec<SupabaseProject>, Error> {
    supabase::list_projects(&state.storage).await
}

/// Resolves the real Supavisor pooler host for a project (the cluster index
/// can't be guessed from the region), used to build pooler connection strings.
#[tauri::command]
#[specta::specta]
pub async fn supabase_pooler_host(
    project_ref: String,
    state: State<'_, AppState>,
) -> Result<String, Error> {
    supabase::pooler_host(&state.storage, &project_ref).await
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

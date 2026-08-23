use serde::Serialize;
use specta::Type;
use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        services::connection::ConnectionService,
        types::{ConnectionInfo, DatabaseSchema},
    },
    error::Error,
    storage::{SavedQuery, SnippetFolder},
    AppState,
};

/// The settings document the renderer reads on boot. Settings are stored as one
/// serialized blob rather than a row per key, so bootstrap carries it verbatim
/// and the renderer sanitizes it.
const UI_SETTINGS_KEY: &str = "ui_settings";

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CachedSchema {
    pub connection_id: Uuid,
    pub schema: DatabaseSchema,
}

/// Everything the renderer needs before it can dismiss the boot screen, in one
/// IPC round-trip. Each field used to be its own command, which made the first
/// paint wait on a serial chain of them.
#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapData {
    pub connections: Vec<ConnectionInfo>,
    /// The raw `ui_settings` document, or None when the user has never saved
    /// settings. The renderer applies its own defaults and validation.
    pub settings: Option<String>,
    pub saved_queries: Vec<SavedQuery>,
    pub snippets: Vec<SavedQuery>,
    pub snippet_folders: Vec<SnippetFolder>,
    /// Schemas already in the in-process cache. Empty on a cold start, populated
    /// after a webview reload — which is exactly when reintrospecting every
    /// table would be most visible.
    pub schemas: Vec<CachedSchema>,
}

#[tauri::command]
#[specta::specta]
pub async fn bootstrap(state: State<'_, AppState>) -> Result<BootstrapData, Error> {
    let connection_svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    let connections = connection_svc.get_connections().await?;

    let settings = state.storage.get_setting(UI_SETTINGS_KEY)?;

    // Saved queries and snippets share one table, distinguished by `is_snippet`.
    // Reading once and partitioning keeps bootstrap to a single scan.
    let (snippets, saved_queries) = state
        .storage
        .get_saved_queries(None)?
        .into_iter()
        .partition(|query| query.is_snippet);

    let snippet_folders = state.storage.get_snippet_folders()?;

    let schemas = state
        .schemas
        .iter()
        .map(|entry| CachedSchema {
            connection_id: *entry.key(),
            schema: (**entry.value()).clone(),
        })
        .collect();

    Ok(BootstrapData {
        connections,
        settings,
        saved_queries,
        snippets,
        snippet_folders,
        schemas,
    })
}

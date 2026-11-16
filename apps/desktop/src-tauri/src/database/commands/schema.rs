use std::sync::Arc;

use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        metadata::DatabaseMetadata,
        row_count_refresher::{pending_counts, RowCountRefresher},
        services::metadata::MetadataService,
        types::DatabaseSchema,
    },
    error::Error,
    AppState,
};

#[tauri::command]
#[specta::specta]
pub async fn get_database_schema(
    connection_id: Uuid,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    refresher: State<'_, RowCountRefresher>,
) -> Result<Arc<DatabaseSchema>, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
        schema_locks: &state.schema_locks,
    };
    // A cache miss means an introspection just ran; mirror its result to disk
    // so the next cold start can paint the sidebar before connecting. The
    // mirror is a serialize, an encrypt and a synced write, so it runs off the
    // reply path, and it writes whatever the cache holds by then: nothing if
    // the schema was invalidated, the patched copy if row counts already landed.
    let was_cached = state.schemas.contains_key(&connection_id);
    let schema = svc.get_database_schema(connection_id).await?;
    if !was_cached {
        super::run_off_reply_path(&app, move |state| {
            let cached = state
                .schemas
                .get(&connection_id)
                .map(|entry| Arc::clone(entry.value()));
            if let Some(cached) = cached {
                crate::database::schema_persistence::persist_schema(
                    &state.storage,
                    connection_id,
                    &cached,
                );
            }
        });
    }
    refresher.schedule(connection_id, pending_counts(&schema));
    Ok(schema)
}

#[tauri::command]
#[specta::specta]
pub async fn get_database_metadata(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<DatabaseMetadata, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
        schema_locks: &state.schema_locks,
    };
    svc.get_database_metadata(connection_id).await
}

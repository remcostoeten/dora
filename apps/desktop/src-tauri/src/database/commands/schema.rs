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
    state: State<'_, AppState>,
    refresher: State<'_, RowCountRefresher>,
) -> Result<DatabaseSchema, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
        schema_locks: &state.schema_locks,
    };
    let schema = svc.get_database_schema(connection_id).await?;
    refresher.schedule(connection_id, pending_counts(&schema));
    Ok((*schema).clone())
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

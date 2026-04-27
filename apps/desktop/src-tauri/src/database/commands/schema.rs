use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        metadata::DatabaseMetadata, services::metadata::MetadataService, types::DatabaseSchema,
    },
    error::Error,
    AppState,
};

#[tauri::command]
#[specta::specta]
pub async fn get_database_schema(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<DatabaseSchema, Error> {
    let svc = MetadataService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.get_database_schema(connection_id)
        .await
        .map(|s| (*s).clone())
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
    };
    svc.get_database_metadata(connection_id).await
}

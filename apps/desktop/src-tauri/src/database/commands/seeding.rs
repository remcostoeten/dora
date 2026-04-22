use tauri::State;
use uuid::Uuid;

use crate::{
    database::services::seeding::{SeedResult, SeedingService},
    error::Error,
    AppState,
};

#[tauri::command]
#[specta::specta]
pub async fn seed_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    count: u32,
    state: State<'_, AppState>,
) -> Result<SeedResult, Error> {
    let svc = SeedingService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.seed_table(connection_id, table_name, schema_name, count).await
}

use tauri::State;
use uuid::Uuid;

use crate::{
    database::{
        maintenance::{DumpResult, SoftDeleteResult, TruncateResult},
        services::mutation::{ExportFormat, MutationResult, MutationService},
    },
    error::Error,
    AppState,
};

fn mutation_service<'a>(state: &'a AppState) -> MutationService<'a> {
    MutationService {
        connection_repo: state,
        schemas: &state.schemas,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn insert_row(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    row_data: serde_json::Map<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.insert_row(connection_id, table_name, schema_name, row_data)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn update_cell(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_value: serde_json::Value,
    column_name: String,
    new_value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.update_cell(
        connection_id,
        table_name,
        schema_name,
        primary_key_column,
        primary_key_value,
        column_name,
        new_value,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_rows(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.delete_rows(
        connection_id,
        table_name,
        schema_name,
        primary_key_column,
        primary_key_values,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn duplicate_row(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.duplicate_row(
        connection_id,
        table_name,
        schema_name,
        primary_key_column,
        primary_key_value,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn export_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    format: ExportFormat,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<String, Error> {
    let svc = mutation_service(state.inner());
    svc.export_table(connection_id, table_name, schema_name, format, limit)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn soft_delete_rows(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    soft_delete_column: Option<String>,
    state: State<'_, AppState>,
) -> Result<SoftDeleteResult, Error> {
    let svc = mutation_service(state.inner());
    svc.soft_delete_rows(
        connection_id,
        table_name,
        schema_name,
        primary_key_column,
        primary_key_values,
        soft_delete_column,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn undo_soft_delete(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    primary_key_values: Vec<serde_json::Value>,
    soft_delete_column: String,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.undo_soft_delete(
        connection_id,
        table_name,
        schema_name,
        primary_key_column,
        primary_key_values,
        soft_delete_column,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn truncate_table(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    cascade: Option<bool>,
    state: State<'_, AppState>,
) -> Result<TruncateResult, Error> {
    let svc = mutation_service(state.inner());
    svc.truncate_table(connection_id, table_name, schema_name, cascade)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn truncate_database(
    connection_id: Uuid,
    schema_name: Option<String>,
    confirm: bool,
    state: State<'_, AppState>,
) -> Result<TruncateResult, Error> {
    let svc = mutation_service(state.inner());
    svc.truncate_database(connection_id, schema_name, confirm)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn dump_database(
    connection_id: Uuid,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<DumpResult, Error> {
    let svc = mutation_service(state.inner());
    svc.dump_database(connection_id, output_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn execute_batch(
    connection_id: Uuid,
    statements: Vec<String>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = mutation_service(state.inner());
    svc.execute_batch(connection_id, statements).await
}

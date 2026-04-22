use tauri::State;
use uuid::Uuid;

use crate::{
    database::services::schema_export::{ExportDialect, SchemaExportService},
    error::Error,
    AppState,
};

/// Export database schema to SQL DDL format.
#[tauri::command]
#[specta::specta]
pub async fn export_schema_sql(
    connection_id: Uuid,
    dialect: String,
    state: State<'_, AppState>,
) -> Result<String, Error> {
    let export_dialect = ExportDialect::try_from(dialect.as_str())?;
    let svc = SchemaExportService {
        schemas: &state.schemas,
    };
    svc.export_to_sql(connection_id, export_dialect)
}

/// Export database schema to Drizzle ORM TypeScript format.
#[tauri::command]
#[specta::specta]
pub async fn export_schema_drizzle(
    connection_id: Uuid,
    dialect: String,
    state: State<'_, AppState>,
) -> Result<String, Error> {
    let export_dialect = ExportDialect::try_from(dialect.as_str())?;
    let svc = SchemaExportService {
        schemas: &state.schemas,
    };
    svc.export_to_drizzle(connection_id, export_dialect)
}

use crate::{database::services::query_builder::QueryBuilderService, error::Error};

#[tauri::command]
#[specta::specta]
pub async fn parse_sql(sql: String) -> Result<serde_json::Value, Error> {
    let svc = QueryBuilderService;
    let ast = svc.parse_sql(&sql)?;
    Ok(serde_json::to_value(ast)?)
}

#[tauri::command]
#[specta::specta]
pub async fn build_sql(ast: serde_json::Value) -> Result<String, Error> {
    let svc = QueryBuilderService;
    let statements: Vec<sqlparser::ast::Statement> = serde_json::from_value(ast)?;
    svc.build_sql(statements).map_err(Error::from)
}

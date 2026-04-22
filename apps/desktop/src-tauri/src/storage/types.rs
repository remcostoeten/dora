use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct QueryHistoryEntry {
    pub id: i64,
    pub connection_id: String,
    pub query_text: String,
    pub executed_at: i64,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub row_count: i64,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct SavedQuery {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub query_text: String,
    pub connection_id: Option<Uuid>,
    pub tags: Option<String>,
    pub category: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub favorite: bool,
    pub is_snippet: bool,
    pub is_system: bool,
    pub language: Option<String>,
    pub folder_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct ConnectionHistoryEntry {
    pub id: i64,
    pub connection_id: String,
    pub connection_name: String,
    pub database_type: String,
    pub attempted_at: i64,
    pub success: bool,
    pub error_message: Option<String>,
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, specta::Type)]
pub struct SnippetFolder {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub color: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

use uuid::Uuid;
use tauri::State;

use crate::{
    database::{
        services::{
            connection::ConnectionService,
            query::QueryService,
            mutation::MutationService,
            metadata::MetadataService,
            seeding::SeedingService,
            query_builder::QueryBuilderService,
        },
        types::{
            ConnectionInfo, DatabaseInfo, StatementInfo, QueryStatus,
            DatabaseSchema,
        },
        maintenance::{SoftDeleteResult, TruncateResult, DumpResult},
    },
    error::Error,
    AppState,
    storage::{QueryHistoryEntry, SavedQuery, ConnectionHistoryEntry},
};

// Re-exports for compatibility and accessibility
pub use crate::database::services::mutation::{ExportFormat, MutationResult};
pub use crate::database::metadata::DatabaseMetadata;

// Re-export helpers for maintenance.rs
pub use crate::database::services::mutation::{json_to_pg_param, json_to_sqlite_value};

// =============================================================================
// Connection Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn add_connection(
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.add_connection(name, database_info, color).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_connection(
    conn_id: Uuid,
    name: String,
    database_info: DatabaseInfo,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<ConnectionInfo, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.update_connection(conn_id, name, database_info, color).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_connection_color(
    connection_id: Uuid,
    color: Option<i32>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.update_connection_color(connection_id, color).await
}

#[tauri::command]
#[specta::specta]
pub async fn connect_to_database(
    connection_id: Uuid,
    state: State<'_, AppState>,
    monitor: State<'_, crate::database::ConnectionMonitor>,
    certificates: State<'_, crate::database::Certificates>,
) -> Result<bool, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.connect_to_database(&monitor, &certificates, connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn disconnect_from_database(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.disconnect_from_database(connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionInfo>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.get_connections().await
}

#[tauri::command]
#[specta::specta]
pub async fn remove_connection(
    connection_id: Uuid,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.remove_connection(connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn test_connection(
    database_info: DatabaseInfo,
    certificates: State<'_, crate::database::Certificates>,
) -> Result<bool, Error> {
    ConnectionService::test_connection(database_info, &certificates).await
}

#[tauri::command]
#[specta::specta]
pub async fn initialize_connections(state: State<'_, AppState>) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.initialize_connections().await
}

#[tauri::command]
#[specta::specta]
pub async fn get_recent_connections(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionInfo>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.get_recent_connections(limit).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_connection_history(
    db_type_filter: Option<String>,
    success_filter: Option<bool>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_connection_history(db_type_filter, success_filter, limit).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_connection_pin(
    connection_id: Uuid,
    pin: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.set_connection_pin(connection_id, pin).await
}

#[tauri::command]
#[specta::specta]
pub async fn verify_pin_and_get_credentials(
    connection_id: Uuid,
    pin: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, Error> {
    let svc = ConnectionService {
        connections: &state.connections,
        storage: &state.storage,
    };
    svc.verify_pin_and_get_credentials(connection_id, pin).await
}


// =============================================================================
// Query Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn start_query(
    connection_id: Uuid,
    query: &str,
    state: State<'_, AppState>,
) -> Result<Vec<usize>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.start_query(connection_id, query).await
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_query(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<StatementInfo, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.fetch_query(query_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_page(
    query_id: usize,
    page_index: usize,
    state: State<'_, AppState>,
) -> Result<Option<Box<serde_json::value::RawValue>>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.fetch_page(query_id, page_index).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_query_status(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<QueryStatus, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_query_status(query_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_page_count(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<usize, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_page_count(query_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_columns(
    query_id: usize,
    state: State<'_, AppState>,
) -> Result<Option<Box<serde_json::value::RawValue>>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_columns(query_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn save_query_to_history(
    connection_id: String,
    query: String,
    duration_ms: Option<u64>,
    status: String,
    row_count: u64,
    error_message: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_query_to_history(connection_id, query, duration_ms, status, row_count, error_message).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_query_history(
    connection_id: String,
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_query_history(connection_id, limit).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_recent_queries(
    connection_id: Option<String>,
    limit: Option<u32>,
    status_filter: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<QueryHistoryEntry>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_recent_queries(connection_id, limit, status_filter).await
}


// =============================================================================
// Script Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn save_script(
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_script(name, content, connection_id, description).await
}

#[tauri::command]
#[specta::specta]
pub async fn update_script(
    id: i64,
    name: String,
    content: String,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.update_script(id, name, content, connection_id, description).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_scripts(
    connection_id: Option<Uuid>,
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_scripts(connection_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn delete_script(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.delete_script(id).await
}

// =============================================================================
// Snippet Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn get_snippets(
    language_filter: Option<String>,
    is_system_filter: Option<bool>,
    category_filter: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let conn = state.storage.get_sqlite_connection()?;
    let mut sql = "SELECT id, name, description, query_text, connection_id, tags, category, created_at, updated_at, favorite, is_snippet, is_system, language FROM saved_queries WHERE is_snippet = 1".to_string();
    
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    
    if let Some(lang) = language_filter {
        sql.push_str(" AND language = ?");
        params.push(Box::new(lang));
    }
    
    if let Some(is_sys) = is_system_filter {
        sql.push_str(" AND is_system = ?");
        params.push(Box::new(is_sys));
    }

    if let Some(cat) = category_filter {
        sql.push_str(" AND category LIKE ?");
        params.push(Box::new(format!("%{}%", cat)));
    }
    
    sql.push_str(" ORDER BY is_system DESC, favorite DESC, created_at DESC");
    
    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(SavedQuery {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            query_text: row.get(3)?,
            connection_id: {
                let id: Option<String> = row.get(4)?;
                id.and_then(|s| Uuid::parse_str(&s).ok())
            },
            tags: row.get(5)?,
            category: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
            favorite: row.get(9)?,
            is_snippet: row.get(10)?,
            is_system: row.get(11)?,
            language: row.get(12)?,
        })
    })?;
    
    let mut snippets = Vec::new();
    for row in rows {
        snippets.push(row?);
    }
    
    Ok(snippets)
}

#[tauri::command]
#[specta::specta]
pub async fn save_snippet(
    name: String,
    content: String,
    language: Option<String>,
    tags: Option<String>,
    category: Option<String>,
    connection_id: Option<Uuid>,
    description: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    let now = chrono::Utc::now().timestamp();
    let snippet = SavedQuery {
        id: 0,
        name,
        description,
        query_text: content,
        connection_id,
        tags,
        category,
        created_at: now,
        updated_at: now,
        favorite: false,
        is_snippet: true,
        is_system: false,
        language,
    };
    
    state.storage.save_query(&snippet)
}

#[tauri::command]
#[specta::specta]
pub async fn update_snippet(
    id: i64,
    name: String,
    content: String,
    language: Option<String>,
    tags: Option<String>,
    category: Option<String>,
    description: Option<String>,
    folder_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let now = chrono::Utc::now().timestamp();
    let conn = state.storage.get_sqlite_connection()?;
    
    conn.execute(
        "UPDATE saved_queries 
         SET name = ?1, query_text = ?2, language = ?3, tags = ?4, category = ?5, 
             description = ?6, folder_id = ?7, updated_at = ?8
         WHERE id = ?9 AND is_snippet = 1",
        (
            &name,
            &content,
            &language,
            &tags,
            &category,
            &description,
            folder_id,
            now,
            id,
        ),
    )?;
    
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_snippet(
    id: i64,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let conn = state.storage.get_sqlite_connection()?;
    conn.execute("DELETE FROM saved_queries WHERE id = ?1 AND is_snippet = 1", [id])?;
    Ok(())
}

// =============================================================================
// Snippet Folder Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn get_snippet_folders(
    state: State<'_, AppState>,
) -> Result<Vec<crate::storage::SnippetFolder>, Error> {
    state.storage.get_snippet_folders()
}

#[tauri::command]
#[specta::specta]
pub async fn create_snippet_folder(
    name: String,
    parent_id: Option<i64>,
    color: Option<String>,
    state: State<'_, AppState>,
) -> Result<i64, Error> {
    state.storage.create_snippet_folder(&name, parent_id, color.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn update_snippet_folder(
    id: i64,
    name: String,
    color: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.update_snippet_folder(id, &name, color.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_snippet_folder(
    id: i64,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.delete_snippet_folder(id)
}

#[tauri::command]
#[specta::specta]
pub async fn seed_system_snippets(state: State<'_, AppState>) -> Result<usize, Error> {
    let snippets = vec![
        // Dangerous Operations
        SavedQuery {
            id: 0,
            name: "Drop All Tables".to_string(),
            description: Some("⚠️ DANGER: Drops all tables in the current database".to_string()),
            query_text: "-- WARNING: This query will drop ALL tables\n-- Uncomment to execute:\n-- SELECT 'DROP TABLE IF EXISTS \"' || tablename || '\" CASCADE;' FROM pg_tables WHERE schemaname = 'public';".to_string(),
            connection_id: None,
            tags: Some("drop,admin".to_string()),
            category: Some("Dangerous".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: false,
            is_snippet: true,
            is_system: true,
            language: Some("sql".to_string()),
        },
        SavedQuery {
            id: 0,
            name: "Truncate All Tables".to_string(),
            description: Some("⚠️ DANGER: Deletes all data from all tables".to_string()),
            query_text: "-- WARNING: This query will delete all data\n-- Uncomment to execute:\n-- TRUNCATE TABLE table_name RESTART IDENTITY CASCADE;".to_string(),
            connection_id: None,
            tags: Some("truncate,admin,cleanup".to_string()),
            category: Some("Dangerous".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: false,
            is_snippet: true,
            is_system: true,
            language: Some("sql".to_string()),
        },
        // Common Query Templates
        SavedQuery {
            id: 0,
            name: "Select All".to_string(),
            description: Some("Basic SELECT * template".to_string()),
            query_text: "SELECT * FROM {table_name}\nLIMIT 100;".to_string(),
            connection_id: None,
            tags: Some("select,basic".to_string()),
            category: Some("Templates".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: true,
            is_system: true,
            language: Some("sql".to_string()),
        },
        SavedQuery {
            id: 0,
            name: "Count Grouped".to_string(),
            description: Some("COUNT with GROUP BY template".to_string()),
            query_text: "SELECT {column_name}, COUNT(*) as count\nFROM {table_name}\nGROUP BY {column_name}\nORDER BY count DESC;".to_string(),
            connection_id: None,
            tags: Some("count,aggregate".to_string()),
            category: Some("Templates".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: true,
            is_system: true,
            language: Some("sql".to_string()),
        },
        // Drizzle Templates
        SavedQuery {
            id: 0,
            name: "Drizzle Table Schema".to_string(),
            description: Some("Basic Drizzle table definition template".to_string()),
            query_text: "import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';\n\nexport const {table_name} = pgTable('{table_name}', {\n  id: serial('id').primaryKey(),\n  name: text('name').notNull(),\n  createdAt: timestamp('created_at').defaultNow(),\n});".to_string(),
            connection_id: None,
            tags: Some("schema".to_string()),
            category: Some("Drizzle".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: true,
            is_system: true,
            language: Some("drizzle".to_string()),
        },
    ];
    
    let mut count = 0;
    for snippet in snippets {
        state.storage.save_query(&snippet)?;
        count += 1;
    }
    
    Ok(count)
}


// =============================================================================
// Setting / Session Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn save_session_state(
    session_data: &str,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.save_session_state(session_data).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_session_state(state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_session_state().await
}

#[tauri::command]
#[specta::specta]
pub async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.get_setting(key).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    svc.set_setting(key, value).await
}


// =============================================================================
// Mutation Commands
// =============================================================================

#[tauri::command]
#[specta::specta]
pub async fn insert_row(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    row_data: serde_json::Map<String, serde_json::Value>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.insert_row(connection_id, table_name, schema_name, row_data).await
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.update_cell(connection_id, table_name, schema_name, primary_key_column, primary_key_value, column_name, new_value).await
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.delete_rows(connection_id, table_name, schema_name, primary_key_column, primary_key_values).await
}

#[tauri::command]
#[specta::specta]
pub async fn duplicate_row(
    connection_id: Uuid,
    table_name: String,
    schema_name: Option<String>,
    primary_key_column: String,
    _primary_key_value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    // Fetch existing row data via a query
    let query = if schema_name.is_some() {
        format!("SELECT * FROM \"{}\".\"{}\" WHERE \"{}\" = $1 LIMIT 1", schema_name.as_ref().unwrap(), table_name, primary_key_column)
    } else {
        format!("SELECT * FROM \"{}\" WHERE \"{}\" = ? LIMIT 1", table_name, primary_key_column)
    };

    // Execute query using QueryService
    let query_svc = QueryService {
        connections: &state.connections,
        storage: &state.storage,
        stmt_manager: &state.stmt_manager,
    };
    
    let query_ids = query_svc.start_query(connection_id, &query).await?;
    if query_ids.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("No row found to duplicate")));
    }

    let query_id = query_ids[0];
    let page_data = query_svc.fetch_page(query_id, 0).await?;
    
    if let Some(json_data) = page_data {
        // Parse the first row
        let parsed: serde_json::Value = serde_json::from_str(json_data.get())?;
        if let Some(arr) = parsed.as_array() {
            if let Some(first_row) = arr.get(0) {
                if let Some(obj) = first_row.as_object() {
                    // Remove primary key from the data
                    let mut row_data = obj.clone();
                    row_data.remove(&primary_key_column);
                    
                    // Insert the duplicate
                    let mutation_svc = MutationService {
                        connections: &state.connections,
                        schemas: &state.schemas,
                    };
                    return mutation_svc.insert_row(connection_id, table_name, schema_name, row_data).await;
                }
            }
        }
    }

    Err(Error::Any(anyhow::anyhow!("Failed to parse row data for duplication")))
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.export_table(connection_id, table_name, schema_name, format, limit).await
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.soft_delete_rows(connection_id, table_name, schema_name, primary_key_column, primary_key_values, soft_delete_column).await
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.undo_soft_delete(connection_id, table_name, schema_name, primary_key_column, primary_key_values, soft_delete_column).await
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
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.truncate_table(connection_id, table_name, schema_name, cascade).await
}

#[tauri::command]
#[specta::specta]
pub async fn truncate_database(
    connection_id: Uuid,
    schema_name: Option<String>,
    confirm: bool,
    state: State<'_, AppState>,
) -> Result<TruncateResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.truncate_database(connection_id, schema_name, confirm).await
}

#[tauri::command]
#[specta::specta]
pub async fn dump_database(
    connection_id: Uuid,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<DumpResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.dump_database(connection_id, output_path).await
}

#[tauri::command]
#[specta::specta]
pub async fn execute_batch(
    connection_id: Uuid,
    statements: Vec<String>,
    state: State<'_, AppState>,
) -> Result<MutationResult, Error> {
    let svc = MutationService {
        connections: &state.connections,
        schemas: &state.schemas,
    };
    svc.execute_batch(connection_id, statements).await
}


// =============================================================================
// Metadata Commands
// =============================================================================

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
    svc.get_database_schema(connection_id).await.map(|s| (*s).clone())
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

// Re-export SeedResult for external use
pub use crate::database::services::seeding::SeedResult;

// =============================================================================
// Seeding Commands
// =============================================================================

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

// =============================================================================
// Query Builder Commands
// =============================================================================

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
    // We need to deserialize back to Vec<Statement>
    // Note: sqlparser AST might be tricky to deserialize exactly if it has specific enums
    // But since we enabled serde, it should work.
    let statements: Vec<sqlparser::ast::Statement> = serde_json::from_value(ast)?;
    svc.build_sql(statements).map_err(Error::from)
}

// =============================================================================
// Schema Export Commands
// =============================================================================

use crate::database::services::schema_export::{SchemaExportService, ExportDialect};

/// Export database schema to SQL DDL format
/// 
/// # Arguments
/// * `connection_id` - UUID of the connected database
/// * `dialect` - Target SQL dialect: "postgresql" or "sqlite"
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

/// Export database schema to Drizzle ORM TypeScript format
/// 
/// # Arguments
/// * `connection_id` - UUID of the connected database
/// * `dialect` - Target Drizzle dialect: "postgresql" or "sqlite"
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

// =============================================================================
// AI Commands
// =============================================================================

use crate::database::services::ai::{AIService, AIRequest, AIResponse, AIProvider, SchemaContext, TableContext};

/// Complete a prompt using the configured AI provider
#[tauri::command]
#[specta::specta]
pub async fn ai_complete(
    prompt: String,
    connection_id: Option<Uuid>,
    max_tokens: Option<u32>,
    state: State<'_, AppState>,
) -> Result<AIResponse, Error> {
    // Build schema context if connection_id provided
    let context = if let Some(conn_id) = connection_id {
        if let Some(schema) = state.schemas.get(&conn_id) {
            Some(SchemaContext {
                tables: schema.tables.iter().map(|t| TableContext {
                    name: t.name.clone(),
                    columns: t.columns.iter().map(|c| c.name.clone()).collect(),
                }).collect(),
            })
        } else {
            None
        }
    } else {
        None
    };

    let request = AIRequest {
        prompt,
        context,
        connection_id,
        max_tokens,
    };

    let svc = AIService {
        storage: &state.storage,
    };
    svc.complete(request).await
}

/// Set the AI provider (gemini or ollama)
#[tauri::command]
#[specta::specta]
pub async fn ai_set_provider(
    provider: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let ai_provider = match provider.to_lowercase().as_str() {
        "gemini" => AIProvider::Gemini,
        "ollama" => AIProvider::Ollama,
        _ => return Err(Error::Any(anyhow::anyhow!("Invalid provider: {}", provider))),
    };
    
    let svc = AIService {
        storage: &state.storage,
    };
    svc.set_provider(ai_provider)
}

/// Get the current AI provider
#[tauri::command]
#[specta::specta]
pub async fn ai_get_provider(
    state: State<'_, AppState>,
) -> Result<String, Error> {
    let svc = AIService {
        storage: &state.storage,
    };
    let provider = svc.get_provider()?;
    Ok(match provider {
        AIProvider::Gemini => "gemini".to_string(),
        AIProvider::Ollama => "ollama".to_string(),
    })
}

/// Set the Gemini API key (BYOK)
#[tauri::command]
#[specta::specta]
pub async fn ai_set_gemini_key(
    api_key: String,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    state.storage.set_setting("gemini_api_key", &api_key)?;
    Ok(())
}

/// Configure Ollama endpoint and model
#[tauri::command]
#[specta::specta]
pub async fn ai_configure_ollama(
    endpoint: Option<String>,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    if let Some(ep) = endpoint {
        state.storage.set_setting("ollama_endpoint", &ep)?;
    }
    if let Some(m) = model {
        state.storage.set_setting("ollama_model", &m)?;
    }
    Ok(())
}

/// List available Ollama models
#[tauri::command]
#[specta::specta]
pub async fn ai_list_ollama_models(
    state: State<'_, AppState>,
) -> Result<Vec<String>, Error> {
    let endpoint = state.storage.get_setting("ollama_endpoint")?
        .unwrap_or_else(|| "http://localhost:11434".to_string());
    
    let client = crate::database::services::ai::OllamaClient::new(endpoint, String::new());
    client.list_models().await
}


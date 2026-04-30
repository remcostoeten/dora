use tauri::State;
use uuid::Uuid;

use crate::{error::Error, storage::SavedQuery, AppState};

#[tauri::command]
#[specta::specta]
pub async fn get_snippets(
    language_filter: Option<String>,
    is_system_filter: Option<bool>,
    category_filter: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SavedQuery>, Error> {
    let conn = state.storage.get_sqlite_connection()?;
    let mut sql = "SELECT id, name, description, query_text, connection_id, tags, category, created_at, updated_at, favorite, is_snippet, is_system, language, folder_id FROM saved_queries WHERE is_snippet = 1".to_string();

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
            folder_id: row.get(13)?,
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
    folder_id: Option<i64>,
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
        folder_id,
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
    connection_id: Option<Uuid>,
    state: State<'_, AppState>,
) -> Result<(), Error> {
    let now = chrono::Utc::now().timestamp();
    let conn = state.storage.get_sqlite_connection()?;
    let connection_id_str = connection_id.map(|id| id.to_string());

    conn.execute(
        "UPDATE saved_queries
         SET name = ?1, query_text = ?2, language = ?3, tags = ?4, category = ?5,
             description = ?6, folder_id = ?7, updated_at = ?8, connection_id = ?9
         WHERE id = ?10 AND is_snippet = 1",
        (
            &name,
            &content,
            &language,
            &tags,
            &category,
            &description,
            folder_id,
            now,
            &connection_id_str,
            id,
        ),
    )?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_snippet(id: i64, state: State<'_, AppState>) -> Result<(), Error> {
    let conn = state.storage.get_sqlite_connection()?;
    conn.execute(
        "DELETE FROM saved_queries WHERE id = ?1 AND is_snippet = 1",
        [id],
    )?;
    Ok(())
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
            folder_id: None,
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
            folder_id: None,
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
            folder_id: None,
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
            folder_id: None,
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
            folder_id: None,
        },
    ];

    let mut count = 0;
    for snippet in snippets {
        state.storage.save_query(&snippet)?;
        count += 1;
    }

    Ok(count)
}

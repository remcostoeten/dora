use std::fs;
use std::path::Path;
use anyhow::Context;
use tauri::State;
use crate::storage::{Storage, SavedQuery};
use crate::Result;

pub fn populate_test_queries(storage: &Storage) -> anyhow::Result<()> {
    let test_queries_dir = Path::new("test_queries");
    
    // Define test queries with metadata
    let queries = vec![
        SavedQuery {
            id: 0,
            name: "CREATE Tables".to_string(),
            description: Some("Create sample database schema with users, posts, comments, and categories tables".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("01_create_tables.sql"))
                .context("Failed to read 01_create_tables.sql")?,
            connection_id: None,
            tags: Some("create,setup,crud".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "INSERT Data".to_string(),
            description: Some("Insert sample data for testing CRUD operations".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("02_insert_data.sql"))
                .context("Failed to read 02_insert_data.sql")?,
            connection_id: None,
            tags: Some("insert,crud,data".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "READ Queries".to_string(),
            description: Some("Various SELECT queries demonstrating read operations".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("03_read_queries.sql"))
                .context("Failed to read 03_read_queries.sql")?,
            connection_id: None,
            tags: Some("select,read,queries".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "UPDATE Operations".to_string(),
            description: Some("Various UPDATE operations for modifying data".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("04_update_queries.sql"))
                .context("Failed to read 04_update_queries.sql")?,
            connection_id: None,
            tags: Some("update,modify,crud".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: false,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "DELETE Operations".to_string(),
            description: Some("Safe DELETE operations with data cleanup examples".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("05_delete_queries.sql"))
                .context("Failed to read 05_delete_queries.sql")?,
            connection_id: None,
            tags: Some("delete,cleanup,crud".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: false,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "Advanced Queries".to_string(),
            description: Some("Window functions, CTEs, and complex joins".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("06_advanced_queries.sql"))
                .context("Failed to read 06_advanced_queries.sql")?,
            connection_id: None,
            tags: Some("advanced,window,cte,join".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: true,
            is_snippet: false,
            is_system: false,
            language: None,
        },
        SavedQuery {
            id: 0,
            name: "Performance Queries".to_string(),
            description: Some("Performance testing and optimization examples".to_string()),
            query_text: fs::read_to_string(test_queries_dir.join("07_performance_queries.sql"))
                .context("Failed to read 07_performance_queries.sql")?,
            connection_id: None,
            tags: Some("performance,optimization,index".to_string()),
            created_at: chrono::Utc::now().timestamp(),
            updated_at: chrono::Utc::now().timestamp(),
            favorite: false,
            is_snippet: false,
            is_system: false,
            language: None,
        },
    ];

    // Insert each query into database
    let query_count = queries.len();
    for query in queries {
        let id = storage.save_query(&query)
            .with_context(|| format!("Failed to save query: {}", query.name))?;
        println!("Saved test query '{}' with ID: {}", query.name, id);
    }

    println!("Successfully populated {} test queries", query_count);
    Ok(())
}

#[tauri::command]
pub fn populate_test_queries_command(storage: State<'_, Storage>) -> Result<String> {
    match populate_test_queries(&storage) {
        Ok(()) => Ok("Test queries populated successfully".to_string()),
        Err(e) => Err(crate::Error::Any(e)),
    }
}
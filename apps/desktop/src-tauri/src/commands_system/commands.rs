//! Tauri command handlers for the commands system

use crate::{AppState, Result};
use super::types::{CommandDefinition, ShortcutDefinition, StoredShortcut};

/// Get all available commands
#[tauri::command]
pub async fn get_all_commands(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<CommandDefinition>> {
    let registry = state.command_registry.read()
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to read registry: {}", e)))?;
    Ok(registry.all_owned())
}

/// Get a single command by ID
#[tauri::command]
pub async fn get_command(
    command_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<CommandDefinition>> {
    let registry = state.command_registry.read()
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to read registry: {}", e)))?;
    Ok(registry.get(&command_id).cloned())
}

/// Update a command's keyboard shortcut
#[tauri::command]
pub async fn update_command_shortcut(
    command_id: String,
    keys: Option<Vec<String>>,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let shortcut = keys.map(|k| ShortcutDefinition {
        keys: k,
        enabled: true,
    });
    
    // Persist to database first - if this fails, we don't update in-memory state
    if let Some(ref s) = shortcut {
        save_shortcut_to_db(&state.storage, &command_id, s)?;
    } else {
        delete_shortcut_from_db(&state.storage, &command_id)?;
    }

    // Update in registry after successful persistence
    {
        let mut registry = state.command_registry.write()
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to write registry: {}", e)))?;
        registry.update_shortcut(&command_id, shortcut.clone());
    }
    
    Ok(())
}

/// Get all custom shortcuts from database
#[tauri::command]
pub async fn get_custom_shortcuts(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<StoredShortcut>> {
    get_shortcuts_from_db(&state.storage)
}

// Database helpers

fn save_shortcut_to_db(
    storage: &crate::storage::Storage,
    command_id: &str,
    shortcut: &ShortcutDefinition,
) -> Result<()> {
    let keys_json = serde_json::to_string(&shortcut.keys)
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to serialize keys: {}", e)))?;
    
    let conn = storage.get_sqlite_connection()?;
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT OR REPLACE INTO keyboard_shortcuts (command_id, keys, enabled, created_at, updated_at) 
         VALUES (?1, ?2, ?3, 
            COALESCE((SELECT created_at FROM keyboard_shortcuts WHERE command_id = ?1), ?4),
            ?5)",
        (&command_id, &keys_json, shortcut.enabled, now, now),
    ).map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to save shortcut: {}", e)))?;
    
    Ok(())
}

fn delete_shortcut_from_db(
    storage: &crate::storage::Storage,
    command_id: &str,
) -> Result<()> {
    let conn = storage.get_sqlite_connection()?;
    conn.execute(
        "DELETE FROM keyboard_shortcuts WHERE command_id = ?1",
        [command_id],
    ).map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to delete shortcut: {}", e)))?;
    
    Ok(())
}

fn get_shortcuts_from_db(
    storage: &crate::storage::Storage,
) -> Result<Vec<StoredShortcut>> {
    let conn = storage.get_sqlite_connection()?;
    let mut stmt = conn.prepare(
        "SELECT command_id, keys, enabled, created_at, updated_at FROM keyboard_shortcuts"
    ).map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to prepare statement: {}", e)))?;
    
    let rows = stmt.query_map([], |row| {
        let keys_json: String = row.get(1)?;
        let keys: Vec<String> = serde_json::from_str(&keys_json)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        Ok(StoredShortcut {
            command_id: row.get(0)?,
            keys,
            enabled: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to query shortcuts: {}", e)))?;
    
    let mut shortcuts = Vec::new();
    for row in rows {
        shortcuts.push(row.map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to process row: {}", e)))?);
    }
    
    Ok(shortcuts)
}

/// Load custom shortcuts from database and apply to registry
pub fn load_custom_shortcuts(
    storage: &crate::storage::Storage,
    registry: &mut super::CommandRegistry,
) -> Result<()> {
    let shortcuts = get_shortcuts_from_db(storage)?;
    
    for shortcut in shortcuts {
        registry.update_shortcut(
            &shortcut.command_id,
            Some(ShortcutDefinition {
                keys: shortcut.keys,
                enabled: shortcut.enabled,
            }),
        );
    }
    
    Ok(())
}

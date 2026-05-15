use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::{config::AppConfig, AppState, Result};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegisteredDatabase {
    pub name: String,
    pub path: String,
    pub active: bool,
}

#[tauri::command]
#[specta::specta]
pub fn list_databases(_state: State<'_, AppState>) -> Result<Vec<RegisteredDatabase>> {
    let config = AppConfig::load()?;
    let active = config.storage.active.clone();
    Ok(config
        .databases
        .into_iter()
        .map(|db| {
            let is_active = db.name == active;
            RegisteredDatabase {
                name: db.name,
                path: db.path,
                active: is_active,
            }
        })
        .collect())
}

#[tauri::command]
#[specta::specta]
pub fn get_active_storage_path(state: State<'_, AppState>) -> Result<String> {
    state.storage.active_path_string()
}

#[tauri::command]
#[specta::specta]
pub fn switch_storage(name: String, state: State<'_, AppState>) -> Result<()> {
    let mut config = AppConfig::load()?;
    let previous_active = config.storage.active.clone();

    let path_str = config
        .databases
        .iter()
        .find(|db| db.name == name)
        .ok_or_else(|| {
            crate::Error::Any(anyhow::anyhow!("database '{}' not found in config", name))
        })?
        .path
        .clone();

    let path = crate::config::expand_tilde(&path_str);
    config.storage.active = name.clone();
    config.save()?;

    if let Err(error) = state.storage.swap_database(path) {
        config.storage.active = previous_active;
        if let Err(restore_error) = config.save() {
            log::error!(
                "failed to restore previous storage config after switch error: {restore_error}"
            );
        }
        return Err(error);
    }

    // Reload command registry from the new DB
    let mut registry = state
        .command_registry
        .write()
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("lock command_registry: {e}")))?;
    *registry = crate::commands_system::CommandRegistry::new();
    if let Err(e) = crate::commands_system::load_custom_shortcuts(&state.storage, &mut *registry) {
        log::warn!("reload shortcuts after storage switch: {e}");
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn register_database(name: String, path: String, _state: State<'_, AppState>) -> Result<()> {
    let mut config = AppConfig::load()?;
    if config.databases.iter().any(|db| db.name == name) {
        return Err(crate::Error::Any(anyhow::anyhow!(
            "database '{}' already registered",
            name
        )));
    }
    config
        .databases
        .push(crate::config::DatabaseEntry { name, path });
    config.save()
}

#[tauri::command]
#[specta::specta]
pub fn create_database(name: String, path: String, _state: State<'_, AppState>) -> Result<()> {
    let mut config = AppConfig::load()?;
    if config.databases.iter().any(|db| db.name == name) {
        return Err(crate::Error::Any(anyhow::anyhow!(
            "database '{}' already exists",
            name
        )));
    }
    let db_path = crate::config::expand_tilde(&path);
    // Opening creates the file and runs migrations
    let _ = crate::storage::Storage::new(db_path)?;
    config
        .databases
        .push(crate::config::DatabaseEntry { name, path });
    config.save()
}

#[tauri::command]
#[specta::specta]
pub fn reset_storage(state: State<'_, AppState>) -> Result<()> {
    state.storage.reset_all_rows()
}

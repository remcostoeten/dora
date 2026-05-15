use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseEntry {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageSection {
    pub active: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub databases: Vec<DatabaseEntry>,
    pub storage: StorageSection,
}

impl AppConfig {
    fn config_path() -> PathBuf {
        dirs::config_dir()
            .expect("no config dir")
            .join("dora")
            .join("config.toml")
    }

    fn default_db_path() -> PathBuf {
        dirs::config_dir()
            .expect("no config dir")
            .join("dora")
            .join("sqlite-storage")
            .join("Dora.db")
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path();
        if !path.exists() {
            let config = Self::with_default_db(Self::default_db_path());
            config.save()?;
            return Ok(config);
        }
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("read config: {e}")))?;
        toml::from_str(&raw)
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("parse config: {e}")))
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| crate::Error::Any(anyhow::anyhow!("create config dir: {e}")))?;
        }
        let raw = toml::to_string_pretty(self)
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("serialize config: {e}")))?;
        std::fs::write(&path, raw)
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("write config: {e}")))
    }

    fn with_default_db(db_path: PathBuf) -> Self {
        AppConfig {
            databases: vec![DatabaseEntry {
                name: "default".into(),
                path: db_path.to_string_lossy().into_owned(),
            }],
            storage: StorageSection {
                active: "default".into(),
            },
        }
    }

    /// Priority: DORA_STORAGE_PATH env var > config active entry > hardcoded default.
    pub fn resolve_active_path(&self) -> Result<PathBuf> {
        if let Ok(env_path) = std::env::var("DORA_STORAGE_PATH") {
            return Ok(PathBuf::from(env_path));
        }
        let entry = self
            .databases
            .iter()
            .find(|db| db.name == self.storage.active)
            .ok_or_else(|| {
                crate::Error::Any(anyhow::anyhow!(
                    "active db '{}' not in config",
                    self.storage.active
                ))
            })?;
        Ok(expand_tilde(&entry.path))
    }
}

pub fn expand_tilde(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}

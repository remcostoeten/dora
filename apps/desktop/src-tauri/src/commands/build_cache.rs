use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{Error, Result};

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct BuildCacheEntry {
    pub name: String,
    pub path: String,
    pub bytes: u64,
    pub removable: bool,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct BuildCacheStats {
    pub target_path: String,
    pub exists: bool,
    pub total_bytes: u64,
    pub entries: Vec<BuildCacheEntry>,
}

#[derive(Debug, Clone, Deserialize, specta::Type)]
pub struct BuildCacheCleanRequest {
    pub entries: Vec<String>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct BuildCacheCleanResult {
    pub removed_bytes: u64,
    pub removed_entries: Vec<String>,
    pub stats: BuildCacheStats,
}

fn default_target_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target")
}

fn dir_size(path: &Path) -> Result<u64> {
    if !path.exists() {
        return Ok(0);
    }

    let metadata = fs::symlink_metadata(path)?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    if !metadata.is_dir() {
        return Ok(0);
    }

    let mut total = 0;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        total += dir_size(&entry.path())?;
    }
    Ok(total)
}

fn validate_entry_name(name: &str) -> Result<()> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains('/')
        || name.contains('\\')
        || name.contains(std::path::MAIN_SEPARATOR)
    {
        return Err(Error::InvalidInput(format!(
            "invalid build cache entry name: {name}"
        )));
    }
    Ok(())
}

pub fn get_build_cache_stats_at(target_dir: &Path) -> Result<BuildCacheStats> {
    let exists = target_dir.exists();
    let mut entries = Vec::new();

    if exists {
        for entry in fs::read_dir(target_dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let bytes = dir_size(&path)?;
            entries.push(BuildCacheEntry {
                name,
                path: path.to_string_lossy().to_string(),
                bytes,
                removable: true,
            });
        }
    }

    entries.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.name.cmp(&b.name)));
    let total_bytes = entries.iter().map(|entry| entry.bytes).sum();

    Ok(BuildCacheStats {
        target_path: target_dir.to_string_lossy().to_string(),
        exists,
        total_bytes,
        entries,
    })
}

pub fn clean_build_cache_at(
    target_dir: &Path,
    request: BuildCacheCleanRequest,
) -> Result<BuildCacheCleanResult> {
    let target_dir = target_dir.canonicalize().map_err(|error| {
        Error::InvalidInput(format!(
            "build cache target does not exist at {}: {error}",
            target_dir.display()
        ))
    })?;

    let mut removed_bytes = 0;
    let mut removed_entries = Vec::new();

    for name in request.entries {
        validate_entry_name(&name)?;
        let path = target_dir.join(&name);
        let canonical_path = path.canonicalize().map_err(|error| {
            Error::InvalidInput(format!(
                "build cache entry does not exist at {}: {error}",
                path.display()
            ))
        })?;

        if !canonical_path.starts_with(&target_dir) {
            return Err(Error::PermissionDenied(format!(
                "refusing to remove path outside build cache: {}",
                canonical_path.display()
            )));
        }

        let bytes = dir_size(&canonical_path)?;
        let metadata = fs::symlink_metadata(&canonical_path)?;
        if metadata.is_dir() {
            fs::remove_dir_all(&canonical_path)?;
        } else if metadata.is_file() {
            fs::remove_file(&canonical_path)?;
        } else {
            return Err(Error::InvalidInput(format!(
                "unsupported build cache entry type: {}",
                canonical_path.display()
            )));
        }

        removed_bytes += bytes;
        removed_entries.push(name);
    }

    let stats = get_build_cache_stats_at(&target_dir)?;
    Ok(BuildCacheCleanResult {
        removed_bytes,
        removed_entries,
        stats,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn get_build_cache_stats() -> Result<BuildCacheStats> {
    get_build_cache_stats_at(&default_target_dir())
}

#[tauri::command]
#[specta::specta]
pub async fn clean_build_cache(request: BuildCacheCleanRequest) -> Result<BuildCacheCleanResult> {
    clean_build_cache_at(&default_target_dir(), request)
}

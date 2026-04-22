mod connection_history;
mod connections;
mod migrator;
mod queries;
mod serialize;
mod settings;
mod snippet_folders;
mod types;

pub use types::{ConnectionHistoryEntry, QueryHistoryEntry, SavedQuery, SnippetFolder};

use std::path::PathBuf;
use std::sync::Mutex;

use anyhow::Context;
use rusqlite::Connection;

use self::migrator::Migrator;
use crate::Result;

#[derive(Debug)]
pub struct Storage {
    pub(super) conn: Mutex<Connection>,
}

impl Storage {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).with_context(|| {
                format!("Failed to create database directory: {}", parent.display())
            })?;
        }

        let mut conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open SQLite database at {}", db_path.display()))?;

        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            PRAGMA busy_timeout = 30000;
            PRAGMA case_sensitive_like = ON;
            PRAGMA extended_result_codes = ON;
            ",
        )
        .context("Failed to execute database initialization SQL")?;

        Migrator::new().migrate(&mut conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Lock and return the underlying SQLite connection.
    pub fn get_sqlite_connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to lock connection: {}", e)))
    }
}

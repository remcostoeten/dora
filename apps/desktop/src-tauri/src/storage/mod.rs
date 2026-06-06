mod ai_keys;
mod ai_usage;
mod connection_history;
mod connections;
mod migrator;
mod queries;
mod serialize;
mod settings;
mod snippet_folders;
mod types;

pub use ai_keys::AiApiKeyRecord;
pub use ai_usage::{AiUsageInsert, AiUsageRow};
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
    active_path: Mutex<PathBuf>,
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

        Self::init_pragmas(&mut conn)?;
        Migrator::new().migrate(&mut conn)?;

        let storage = Self {
            conn: Mutex::new(conn),
            active_path: Mutex::new(db_path),
        };
        if let Err(error) = storage.migrate_legacy_gemini_key() {
            tracing::warn!("Gemini key migration skipped: {error}");
        }

        Ok(storage)
    }

    fn init_pragmas(conn: &mut Connection) -> Result<()> {
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
        Ok(())
    }

    /// Lock and return the underlying SQLite connection.
    pub fn get_sqlite_connection(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("Failed to lock connection: {}", e)))
    }

    pub fn active_path_string(&self) -> Result<String> {
        Ok(self
            .active_path
            .lock()
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("lock active_path: {e}")))?
            .to_string_lossy()
            .into_owned())
    }

    /// WAL checkpoint → open new connection at `new_path` with migrations → swap in place.
    pub fn swap_database(&self, new_path: PathBuf) -> Result<()> {
        let mut guard = self.get_sqlite_connection()?;

        guard
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .context("WAL checkpoint failed")?;

        if let Some(parent) = new_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create db dir: {}", parent.display()))?;
        }

        let mut new_conn = Connection::open(&new_path)
            .with_context(|| format!("open db at {}", new_path.display()))?;

        Self::init_pragmas(&mut new_conn)?;
        Migrator::new().migrate(&mut new_conn)?;

        *guard = new_conn;

        if let Err(error) = self.migrate_legacy_gemini_key() {
            tracing::warn!("Gemini key migration skipped: {error}");
        }

        *self
            .active_path
            .lock()
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("lock active_path: {e}")))? = new_path;

        Ok(())
    }

    /// Delete all rows from every user table in the active database.
    pub fn reset_all_rows(&self) -> Result<()> {
        let mut guard = self.get_sqlite_connection()?;

        let tables: Vec<String> = {
            let mut stmt = guard
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_sqlx_migrations'",
                )
                .context("query table list")?;
            let rows: Vec<rusqlite::Result<String>> = stmt
                .query_map([], |row| row.get(0))
                .context("fetch table names")?
                .collect();
            rows.into_iter().filter_map(|r| r.ok()).collect()
        };

        guard
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .context("disable fk")?;

        let result = (|| -> Result<()> {
            let tx = guard.transaction().context("start reset transaction")?;

            for table in &tables {
                let escaped_table = table.replace('"', "\"\"");
                tx.execute(&format!("DELETE FROM \"{escaped_table}\";"), [])
                    .with_context(|| format!("delete from {table}"))?;
            }

            tx.commit().context("commit reset transaction")?;
            Ok(())
        })();

        let re_enable_result = guard
            .execute_batch("PRAGMA foreign_keys = ON;")
            .context("re-enable fk");

        match (result, re_enable_result) {
            (Ok(()), Ok(())) => Ok(()),
            (Err(error), _) => Err(error),
            (Ok(()), Err(error)) => Err(error.into()),
        }
    }
}

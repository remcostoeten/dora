use anyhow::Context;

use super::{types::ConnectionHistoryEntry, Storage};
use crate::Result;

impl Storage {
    pub fn save_connection_history(&self, entry: &ConnectionHistoryEntry) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "INSERT INTO connection_history
             (connection_id, connection_name, database_type, attempted_at, success, error_message, duration_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &entry.connection_id,
                &entry.connection_name,
                &entry.database_type,
                entry.attempted_at,
                entry.success,
                &entry.error_message,
                entry.duration_ms,
            ),
        )
        .context("Failed to save connection history")?;
        Ok(())
    }

    pub fn get_connection_history(
        &self,
        db_type_filter: Option<&str>,
        success_filter: Option<bool>,
        limit: Option<i64>,
    ) -> Result<Vec<ConnectionHistoryEntry>> {
        let limit = limit.unwrap_or(50);
        let conn = self.conn.lock().map_err(|_| crate::Error::Internal("lock poisoned".into()))?;

        match (db_type_filter, success_filter) {
            (Some(db_type), Some(success)) => {
                let mut stmt = conn.prepare(
                    "SELECT id, connection_id, connection_name, database_type, attempted_at, success, error_message, duration_ms
                     FROM connection_history
                     WHERE database_type = ?1 AND success = ?2
                     ORDER BY attempted_at DESC
                     LIMIT ?3"
                ).context("Failed to prepare connection history statement")?;

                let rows = stmt
                    .query_map((db_type, success, limit), |row| {
                        Ok(ConnectionHistoryEntry {
                            id: row.get(0)?,
                            connection_id: row.get(1)?,
                            connection_name: row.get(2)?,
                            database_type: row.get(3)?,
                            attempted_at: row.get(4)?,
                            success: row.get(5)?,
                            error_message: row.get(6)?,
                            duration_ms: row.get(7)?,
                        })
                    })
                    .context("Failed to query connection history")?;

                let mut history = Vec::new();
                for row in rows {
                    history.push(row.context("Failed to process history row")?);
                }
                Ok(history)
            }
            (Some(db_type), None) => {
                let mut stmt = conn.prepare(
                    "SELECT id, connection_id, connection_name, database_type, attempted_at, success, error_message, duration_ms
                     FROM connection_history
                     WHERE database_type = ?1
                     ORDER BY attempted_at DESC
                     LIMIT ?2"
                ).context("Failed to prepare connection history statement")?;

                let rows = stmt
                    .query_map((db_type, limit), |row| {
                        Ok(ConnectionHistoryEntry {
                            id: row.get(0)?,
                            connection_id: row.get(1)?,
                            connection_name: row.get(2)?,
                            database_type: row.get(3)?,
                            attempted_at: row.get(4)?,
                            success: row.get(5)?,
                            error_message: row.get(6)?,
                            duration_ms: row.get(7)?,
                        })
                    })
                    .context("Failed to query connection history")?;

                let mut history = Vec::new();
                for row in rows {
                    history.push(row.context("Failed to process history row")?);
                }
                Ok(history)
            }
            (None, Some(success)) => {
                let mut stmt = conn.prepare(
                    "SELECT id, connection_id, connection_name, database_type, attempted_at, success, error_message, duration_ms
                     FROM connection_history
                     WHERE success = ?1
                     ORDER BY attempted_at DESC
                     LIMIT ?2"
                ).context("Failed to prepare connection history statement")?;

                let rows = stmt
                    .query_map((success, limit), |row| {
                        Ok(ConnectionHistoryEntry {
                            id: row.get(0)?,
                            connection_id: row.get(1)?,
                            connection_name: row.get(2)?,
                            database_type: row.get(3)?,
                            attempted_at: row.get(4)?,
                            success: row.get(5)?,
                            error_message: row.get(6)?,
                            duration_ms: row.get(7)?,
                        })
                    })
                    .context("Failed to query connection history")?;

                let mut history = Vec::new();
                for row in rows {
                    history.push(row.context("Failed to process history row")?);
                }
                Ok(history)
            }
            (None, None) => {
                let mut stmt = conn.prepare(
                    "SELECT id, connection_id, connection_name, database_type, attempted_at, success, error_message, duration_ms
                     FROM connection_history
                     ORDER BY attempted_at DESC
                     LIMIT ?1"
                ).context("Failed to prepare connection history statement")?;

                let rows = stmt
                    .query_map([limit], |row| {
                        Ok(ConnectionHistoryEntry {
                            id: row.get(0)?,
                            connection_id: row.get(1)?,
                            connection_name: row.get(2)?,
                            database_type: row.get(3)?,
                            attempted_at: row.get(4)?,
                            success: row.get(5)?,
                            error_message: row.get(6)?,
                            duration_ms: row.get(7)?,
                        })
                    })
                    .context("Failed to query connection history")?;

                let mut history = Vec::new();
                for row in rows {
                    history.push(row.context("Failed to process history row")?);
                }
                Ok(history)
            }
        }
    }
}

use anyhow::Context;
use rusqlite::types::Type;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::Storage;
use crate::{kv::KvConnectionConfig, Error, Result};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KvConnectionInfo {
    pub id: Uuid,
    pub name: String,
    pub config: KvConnectionConfig,
    pub connected: bool,
    pub last_connected_at: Option<i64>,
    pub favorite: bool,
    pub color: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KvCommandHistoryEntry {
    pub id: i64,
    pub connection_id: Uuid,
    pub command_text: String,
    pub executed_at: i64,
    pub duration_ms: Option<i64>,
    pub status: String,
    pub error_message: Option<String>,
}

impl Storage {
    pub fn save_kv_connection(&self, connection: &KvConnectionInfo) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let serialized = serde_json::to_string(&connection.config)?;
        let encrypted = crate::security::encrypt(&serialized)
            .context("Failed to encrypt key-value connection data")?;
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;

        conn.execute(
            "INSERT INTO kv_connections
             (id, name, connection_data, created_at, updated_at, favorite, color, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6,
                (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM kv_connections))
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                connection_data = excluded.connection_data,
                updated_at = excluded.updated_at,
                favorite = excluded.favorite,
                color = excluded.color",
            (
                connection.id.to_string(),
                &connection.name,
                encrypted,
                now,
                connection.favorite,
                connection.color.as_deref(),
            ),
        )
        .context("Failed to save key-value connection")?;
        Ok(())
    }

    pub fn get_kv_connection(&self, id: &Uuid) -> Result<Option<KvConnectionInfo>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, connection_data, last_connected_at,
                        favorite, color, sort_order
                 FROM kv_connections WHERE id = ?1",
            )
            .context("Failed to prepare key-value connection query")?;

        let mut rows = stmt
            .query([id.to_string()])
            .context("Failed to query key-value connection")?;
        let Some(row) = rows.next().context("Failed to read key-value connection")? else {
            return Ok(None);
        };

        Self::decode_kv_connection_row(row).map(Some)
    }

    pub fn get_kv_connections(&self) -> Result<Vec<KvConnectionInfo>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, connection_data, last_connected_at,
                        favorite, color, sort_order
                 FROM kv_connections ORDER BY sort_order, name",
            )
            .context("Failed to prepare key-value connections query")?;
        let mut rows = stmt
            .query([])
            .context("Failed to query key-value connections")?;
        let mut connections = Vec::new();

        while let Some(row) = rows
            .next()
            .context("Failed to read key-value connection row")?
        {
            connections.push(Self::decode_kv_connection_row(row)?);
        }
        Ok(connections)
    }

    fn decode_kv_connection_row(row: &rusqlite::Row<'_>) -> Result<KvConnectionInfo> {
        let id_text: String = row.get(0)?;
        let encrypted: String = row.get(2)?;
        let serialized = crate::security::decrypt(&encrypted)
            .context("Failed to decrypt key-value connection data")?;
        let config = serde_json::from_str(&serialized)
            .context("Failed to deserialize key-value connection data")?;
        let id = Uuid::parse_str(&id_text).map_err(|error| {
            Error::Rusqlite(rusqlite::Error::FromSqlConversionFailure(
                0,
                Type::Text,
                Box::new(error),
            ))
        })?;

        Ok(KvConnectionInfo {
            id,
            name: row.get(1)?,
            config,
            connected: false,
            last_connected_at: row.get(3)?,
            favorite: row.get(4)?,
            color: row.get(5)?,
            sort_order: row.get(6)?,
        })
    }

    pub fn remove_kv_connection(&self, id: &Uuid) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        conn.execute("DELETE FROM kv_connections WHERE id = ?1", [id.to_string()])
            .context("Failed to remove key-value connection")?;
        Ok(())
    }

    pub fn update_kv_last_connected(&self, id: &Uuid) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "UPDATE kv_connections SET last_connected_at = ?1, updated_at = ?1 WHERE id = ?2",
            (chrono::Utc::now().timestamp(), id.to_string()),
        )
        .context("Failed to update key-value connection timestamp")?;
        Ok(())
    }

    pub fn save_kv_command_history(
        &self,
        connection_id: &Uuid,
        command_text: &str,
        duration_ms: Option<i64>,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "INSERT INTO kv_command_history
             (connection_id, command_text, executed_at, duration_ms, status, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                connection_id.to_string(),
                command_text,
                chrono::Utc::now().timestamp(),
                duration_ms,
                status,
                error_message,
            ),
        )
        .context("Failed to save key-value command history")?;
        Ok(())
    }

    pub fn get_kv_command_history(
        &self,
        connection_id: &Uuid,
        limit: u32,
    ) -> Result<Vec<KvCommandHistoryEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, connection_id, command_text, executed_at,
                        duration_ms, status, error_message
                 FROM kv_command_history
                 WHERE connection_id = ?1
                 ORDER BY executed_at DESC, id DESC
                 LIMIT ?2",
            )
            .context("Failed to prepare key-value command history query")?;
        let rows = stmt
            .query_map(
                (connection_id.to_string(), i64::from(limit.min(500))),
                |row| {
                    let id_text: String = row.get(1)?;
                    let id = Uuid::parse_str(&id_text).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(1, Type::Text, Box::new(error))
                    })?;
                    Ok(KvCommandHistoryEntry {
                        id: row.get(0)?,
                        connection_id: id,
                        command_text: row.get(2)?,
                        executed_at: row.get(3)?,
                        duration_ms: row.get(4)?,
                        status: row.get(5)?,
                        error_message: row.get(6)?,
                    })
                },
            )
            .context("Failed to query key-value command history")?;

        rows.collect::<rusqlite::Result<Vec<_>>>()
            .context("Failed to decode key-value command history")
            .map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::{KvConnectionInfo, Storage};
    use crate::kv::KvConnectionConfig;
    use uuid::Uuid;

    #[test]
    fn kv_connection_survives_encrypted_round_trip() {
        let path = std::env::temp_dir().join(format!("dora-kv-storage-{}.sqlite", Uuid::new_v4()));
        let storage = Storage::new(path.clone()).expect("storage should initialize");
        let id = Uuid::new_v4();
        let saved = KvConnectionInfo {
            id,
            name: "Local Valkey".into(),
            config: KvConnectionConfig {
                url: "redis://:secret@127.0.0.1:6379/0".into(),
            },
            connected: false,
            last_connected_at: None,
            favorite: true,
            color: Some("#dc382d".into()),
            sort_order: 0,
        };

        storage
            .save_kv_connection(&saved)
            .expect("key-value connection should save");
        drop(storage);

        let reopened = Storage::new(path.clone()).expect("storage should reopen");
        let loaded = reopened
            .get_kv_connection(&id)
            .expect("key-value connection should load")
            .expect("key-value connection should exist");
        assert_eq!(loaded.name, "Local Valkey");
        assert_eq!(loaded.config.url, saved.config.url);
        assert!(loaded.favorite);
        drop(reopened);
        std::fs::remove_file(path).expect("test database should be removable");
    }
}

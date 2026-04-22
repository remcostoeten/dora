use anyhow::Context;
use rusqlite::types::Type;
use uuid::Uuid;

use super::{
    serialize::{deserialize_database_info, serialize_connection_data},
    Storage,
};
use crate::{database::types::ConnectionInfo, Result};

impl Storage {
    pub fn save_connection(&self, connection: &ConnectionInfo) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();

        let (db_type_id, connection_data) = serialize_connection_data(&connection.database_type)?;

        let encrypted_data = crate::security::encrypt(&connection_data)
            .context("Failed to encrypt connection data")?;

        conn.execute(
            "INSERT OR REPLACE INTO connections
             (id, name, connection_data, database_type_id, created_at, updated_at, sort_order, color)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6,
                (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM connections), ?7)",
            (
                &connection.id.to_string(),
                &connection.name,
                &encrypted_data,
                db_type_id,
                now,
                now,
                connection.color.as_deref(),
            ),
        )
        .context("Failed to save connection")?;

        Ok(())
    }

    pub fn update_connection(&self, connection: &ConnectionInfo) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();

        let (db_type_id, connection_data) = serialize_connection_data(&connection.database_type)?;

        let encrypted_data = crate::security::encrypt(&connection_data)
            .context("Failed to encrypt connection data")?;

        let updated_rows = conn
            .execute(
                "UPDATE connections
             SET name = ?2, connection_data = ?3, database_type_id = ?4, updated_at = ?5, color = ?6
             WHERE id = ?1",
                (
                    &connection.id.to_string(),
                    &connection.name,
                    &encrypted_data,
                    db_type_id,
                    now,
                    connection.color.as_deref(),
                ),
            )
            .context("Failed to update connection")?;

        if updated_rows == 0 {
            return Err(crate::Error::Any(anyhow::anyhow!(
                "Connection not found: {}",
                connection.id
            )));
        }

        Ok(())
    }

    pub fn get_connection(&self, connection_id: &Uuid) -> Result<Option<ConnectionInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.connection_data,
                        c.database_type_id,
                        COALESCE(dt.name, 'postgres') as db_type,
                        c.last_connected_at, c.favorite, c.color, c.sort_order
                 FROM connections c
                 LEFT JOIN database_types dt ON c.database_type_id = dt.id
                 WHERE c.id = ?1",
            )
            .context("Failed to prepare statement")?;

        let mut rows = stmt
            .query_map([connection_id.to_string()], |row| {
                let raw_data: String = row.get(2)?;
                let db_type_id: i32 = row.get(3)?;
                let db_type: String = row.get(4)?;

                // Try to decrypt, otherwise assume plaintext (lazy migration).
                let connection_data = match crate::security::decrypt(&raw_data) {
                    Ok(decrypted) => decrypted,
                    Err(_) => raw_data,
                };

                let database_type = deserialize_database_info(&db_type, db_type_id, connection_data);

                Ok(ConnectionInfo {
                    id: {
                        let id: String = row.get(0)?;
                        Uuid::parse_str(&id).map_err(|err| {
                            rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err))
                        })?
                    },
                    name: row.get(1)?,
                    database_type,
                    connected: false,
                    last_connected_at: row.get(5).ok(),
                    favorite: row.get(6).ok(),
                    color: row.get(7).ok(),
                    sort_order: row.get(8).ok(),
                    created_at: None,
                    updated_at: None,
                    pin_hash: None,
                })
            })
            .context("Failed to query connection")?;

        match rows.next() {
            Some(row) => Ok(Some(row.map_err(|e| {
                anyhow::anyhow!("Failed to process connection row: {}", e)
            })?)),
            None => Ok(None),
        }
    }

    pub fn get_connections(&self) -> Result<Vec<ConnectionInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.connection_data,
                        c.database_type_id,
                        COALESCE(dt.name, 'postgres') as db_type,
                        c.last_connected_at, c.favorite, c.color, c.sort_order
                 FROM connections c
                 LEFT JOIN database_types dt ON c.database_type_id = dt.id
                 ORDER BY c.sort_order, c.name",
            )
            .context("Failed to prepare statement")?;

        let rows = stmt
            .query_map([], |row| {
                let raw_data: String = row.get(2)?;
                let db_type_id: i32 = row.get(3)?;
                let db_type: String = row.get(4)?;

                let connection_data = match crate::security::decrypt(&raw_data) {
                    Ok(decrypted) => decrypted,
                    Err(_) => raw_data,
                };

                let database_type = deserialize_database_info(&db_type, db_type_id, connection_data);

                Ok(ConnectionInfo {
                    id: {
                        let id: String = row.get(0)?;
                        Uuid::parse_str(&id).map_err(|err| {
                            rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err))
                        })?
                    },
                    name: row.get(1)?,
                    database_type,
                    connected: false,
                    last_connected_at: row.get(5).ok(),
                    favorite: row.get(6).ok(),
                    color: row.get(7).ok(),
                    sort_order: row.get(8).ok(),
                    created_at: None,
                    updated_at: None,
                    pin_hash: None,
                })
            })
            .context("Failed to query connections")?;

        let mut connections = Vec::new();
        for row in rows {
            connections
                .push(row.map_err(|e| anyhow::anyhow!("Failed to process connection row: {}", e))?);
        }

        Ok(connections)
    }

    pub fn remove_connection(&self, connection_id: &Uuid) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM connections WHERE id = ?1",
            [connection_id.to_string()],
        )
        .context("Failed to remove connection")?;
        Ok(())
    }

    pub fn update_last_connected(&self, connection_id: &Uuid) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE connections SET last_connected_at = ?1 WHERE id = ?2",
            (now, connection_id.to_string()),
        )
        .context("Failed to update last connected time")?;
        Ok(())
    }
}

use anyhow::Context;
use uuid::Uuid;

use super::Storage;
use crate::Result;

impl Storage {
    pub fn get_schema_snapshots(&self) -> Result<Vec<(Uuid, String)>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare("SELECT connection_id, schema_json FROM schema_snapshots")
            .context("Failed to prepare schema snapshots statement")?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .context("Failed to query schema snapshots")?;

        let mut snapshots = Vec::new();
        for row in rows {
            let (id, json) = row.context("Failed to read schema snapshot row")?;
            if let Ok(connection_id) = Uuid::parse_str(&id) {
                snapshots.push((connection_id, json));
            }
        }
        Ok(snapshots)
    }

    pub fn put_schema_snapshot(&self, connection_id: Uuid, schema_json: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "INSERT OR REPLACE INTO schema_snapshots (connection_id, schema_json, updated_at) VALUES (?1, ?2, ?3)",
            (connection_id.to_string(), schema_json, now),
        )
        .context("Failed to store schema snapshot")?;
        Ok(())
    }

    pub fn delete_schema_snapshot(&self, connection_id: Uuid) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "DELETE FROM schema_snapshots WHERE connection_id = ?1",
            [connection_id.to_string()],
        )
        .context("Failed to delete schema snapshot")?;
        Ok(())
    }

    pub fn delete_all_schema_snapshots(&self) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute("DELETE FROM schema_snapshots", [])
            .context("Failed to clear schema snapshots")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Storage;
    use uuid::Uuid;

    fn temp_storage() -> Storage {
        let path =
            std::env::temp_dir().join(format!("dora-schema-snapshots-{}.sqlite", Uuid::new_v4()));
        Storage::new(path).expect("storage should initialize")
    }

    #[test]
    fn snapshot_round_trips_and_replaces_by_connection() {
        let storage = temp_storage();
        let id = Uuid::new_v4();

        storage.put_schema_snapshot(id, "first").unwrap();
        storage.put_schema_snapshot(id, "second").unwrap();

        let snapshots = storage.get_schema_snapshots().unwrap();
        assert_eq!(snapshots, vec![(id, "second".to_string())]);
    }

    #[test]
    fn delete_removes_one_and_delete_all_clears_the_table() {
        let storage = temp_storage();
        let keep = Uuid::new_v4();
        let drop = Uuid::new_v4();
        storage.put_schema_snapshot(keep, "keep").unwrap();
        storage.put_schema_snapshot(drop, "drop").unwrap();

        storage.delete_schema_snapshot(drop).unwrap();
        assert_eq!(
            storage.get_schema_snapshots().unwrap(),
            vec![(keep, "keep".to_string())]
        );

        storage.delete_all_schema_snapshots().unwrap();
        assert!(storage.get_schema_snapshots().unwrap().is_empty());
    }
}

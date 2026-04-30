use anyhow::Context;

use super::Storage;
use crate::Result;

impl Storage {
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .context("Failed to prepare settings statement")?;
        let mut rows = stmt
            .query_map([key], |row| row.get::<_, String>(0))
            .context("Failed to query settings")?;

        if let Some(row) = rows.next() {
            Ok(Some(row.context("Failed to get setting value")?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            (key, value, now),
        )
        .context("Failed to set setting")?;
        Ok(())
    }
}

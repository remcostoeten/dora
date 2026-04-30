use anyhow::Context;
use serde::{Deserialize, Serialize};

use super::Storage;
use crate::security;
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AiApiKeyRecord {
    pub id: i64,
    pub provider: String,
    pub label: String,
    pub is_active: bool,
    pub last_tested: Option<i64>,
    pub last_status: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Storage {
    pub fn ai_keys_list(&self, provider: &str) -> Result<Vec<AiApiKeyRecord>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, provider, label, is_active, last_tested, last_status, created_at, updated_at \
                 FROM ai_api_keys WHERE provider = ?1 ORDER BY created_at ASC",
            )
            .context("Failed to prepare ai_keys_list statement")?;
        let rows = stmt
            .query_map([provider], |row| {
                Ok(AiApiKeyRecord {
                    id: row.get(0)?,
                    provider: row.get(1)?,
                    label: row.get(2)?,
                    is_active: row.get::<_, i64>(3)? != 0,
                    last_tested: row.get(4)?,
                    last_status: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })
            .context("Failed to query ai_api_keys")?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row.context("Failed to read ai_api_keys row")?);
        }
        Ok(out)
    }

    pub fn ai_keys_active_decrypted(&self, provider: &str) -> Result<Vec<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare(
                "SELECT ciphertext FROM ai_api_keys \
                 WHERE provider = ?1 AND is_active = 1 ORDER BY id ASC",
            )
            .context("Failed to prepare ai_keys_active statement")?;
        let rows = stmt
            .query_map([provider], |row| row.get::<_, String>(0))
            .context("Failed to query active ai_api_keys")?;

        let mut keys = Vec::new();
        for row in rows {
            let ct = row.context("Failed to read ciphertext")?;
            match security::decrypt(&ct) {
                Ok(pt) if !pt.is_empty() => keys.push(pt),
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!("Failed to decrypt ai_api_keys row: {}", e);
                }
            }
        }
        Ok(keys)
    }

    pub fn ai_keys_add(&self, provider: &str, label: &str, plaintext: &str) -> Result<i64> {
        let ciphertext = security::encrypt(plaintext)
            .map_err(|e| crate::Error::Any(anyhow::anyhow!("Encrypt failed: {}", e)))?;
        let now = chrono::Utc::now().timestamp();
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "INSERT INTO ai_api_keys (provider, label, ciphertext, is_active, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 1, ?4, ?4)",
            (provider, label, ciphertext, now),
        )
        .context("Failed to insert ai_api_keys row")?;
        Ok(conn.last_insert_rowid())
    }

    pub fn ai_keys_delete(&self, id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute("DELETE FROM ai_api_keys WHERE id = ?1", [id])
            .context("Failed to delete ai_api_keys row")?;
        Ok(())
    }

    pub fn ai_keys_set_active(&self, id: i64, active: bool) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "UPDATE ai_api_keys SET is_active = ?1, updated_at = ?2 WHERE id = ?3",
            (if active { 1 } else { 0 }, now, id),
        )
        .context("Failed to update ai_api_keys is_active")?;
        Ok(())
    }

    pub fn ai_keys_record_test(&self, id: i64, ok: bool, message: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let status = if ok {
            format!("ok: {}", message)
        } else {
            format!("err: {}", message)
        };
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        conn.execute(
            "UPDATE ai_api_keys SET last_tested = ?1, last_status = ?2, updated_at = ?1 WHERE id = ?3",
            (now, status, id),
        )
        .context("Failed to record ai_keys test")?;
        Ok(())
    }

    pub fn ai_keys_get_decrypted(&self, id: i64) -> Result<Option<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::Error::Internal("lock poisoned".into()))?;
        let mut stmt = conn
            .prepare("SELECT ciphertext FROM ai_api_keys WHERE id = ?1")
            .context("Failed to prepare ai_keys_get statement")?;
        let mut rows = stmt
            .query_map([id], |row| row.get::<_, String>(0))
            .context("Failed to query ai_api_keys by id")?;
        if let Some(row) = rows.next() {
            let ct = row.context("Failed to read ciphertext")?;
            let pt = security::decrypt(&ct)
                .map_err(|e| crate::Error::Any(anyhow::anyhow!("Decrypt failed: {}", e)))?;
            Ok(Some(pt))
        } else {
            Ok(None)
        }
    }
}

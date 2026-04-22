use anyhow::Context;

use super::{types::SnippetFolder, Storage};
use crate::Result;

impl Storage {
    pub fn get_snippet_folders(&self) -> Result<Vec<SnippetFolder>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, parent_id, color, created_at, updated_at
             FROM snippet_folders
             ORDER BY name ASC",
            )
            .context("Failed to prepare snippet folders statement")?;

        let rows = stmt
            .query_map([], |row| {
                Ok(SnippetFolder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    color: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .context("Failed to query snippet folders")?;

        let mut folders = Vec::new();
        for row in rows {
            folders.push(row.context("Failed to process folder row")?);
        }
        Ok(folders)
    }

    pub fn create_snippet_folder(
        &self,
        name: &str,
        parent_id: Option<i64>,
        color: Option<&str>,
    ) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT INTO snippet_folders (name, parent_id, color, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (name, parent_id, color, now, now),
        )
        .context("Failed to create snippet folder")?;

        Ok(conn.last_insert_rowid())
    }

    pub fn update_snippet_folder(
        &self,
        id: i64,
        name: &str,
        color: Option<&str>,
    ) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE snippet_folders SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
            (name, color, now, id),
        )
        .context("Failed to update snippet folder")?;

        Ok(())
    }

    pub fn delete_snippet_folder(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // First set folder_id to NULL for all snippets in this folder.
        conn.execute(
            "UPDATE saved_queries SET folder_id = NULL WHERE folder_id = ?1",
            [id],
        )
        .context("Failed to unlink snippets from folder")?;

        // Then delete the folder (cascade handles child folders).
        conn.execute("DELETE FROM snippet_folders WHERE id = ?1", [id])
            .context("Failed to delete snippet folder")?;

        Ok(())
    }
}

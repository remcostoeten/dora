use anyhow::Context;
use rusqlite::types::Type;
use uuid::Uuid;

use super::{
    types::{QueryHistoryEntry, SavedQuery},
    Storage,
};
use crate::Result;

impl Storage {
    pub fn save_query_history(&self, entry: &QueryHistoryEntry) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO query_history
             (connection_id, query_text, executed_at, duration_ms, status, row_count, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                &entry.connection_id,
                &entry.query_text,
                entry.executed_at,
                entry.duration_ms,
                &entry.status,
                entry.row_count,
                &entry.error_message,
            ),
        )
        .context("Failed to save query history")?;
        Ok(())
    }

    pub fn get_query_history(
        &self,
        connection_id: &str,
        limit: Option<i64>,
    ) -> Result<Vec<QueryHistoryEntry>> {
        let limit = limit.unwrap_or(100);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, connection_id, query_text, executed_at, duration_ms, status, row_count, error_message
             FROM query_history
             WHERE connection_id = ?1
             ORDER BY executed_at DESC
             LIMIT ?2"
        ).context("Failed to prepare query history statement")?;

        let rows = stmt
            .query_map((connection_id, limit), |row| {
                Ok(QueryHistoryEntry {
                    id: row.get(0)?,
                    connection_id: row.get(1)?,
                    query_text: row.get(2)?,
                    executed_at: row.get(3)?,
                    duration_ms: row.get(4)?,
                    status: row.get(5)?,
                    row_count: row.get(6)?,
                    error_message: row.get(7)?,
                })
            })
            .context("Failed to query history")?;

        let mut history = Vec::new();
        for row in rows {
            history.push(row.context("Failed to process history row")?);
        }

        Ok(history)
    }

    pub fn save_query(&self, query: &SavedQuery) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let conn = self.conn.lock().unwrap();

        if query.id == 0 {
            conn.execute(
                "INSERT INTO saved_queries
                 (name, description, query_text, connection_id, tags, category, created_at, updated_at, favorite, is_snippet, is_system, language, folder_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                (
                    &query.name,
                    &query.description,
                    &query.query_text,
                    query.connection_id.as_ref().map(|u| u.to_string()),
                    &query.tags,
                    &query.category,
                    now,
                    now,
                    query.favorite,
                    query.is_snippet,
                    query.is_system,
                    &query.language,
                    query.folder_id,
                ),
            ).context("Failed to insert saved query")?;
            Ok(conn.last_insert_rowid())
        } else {
            conn.execute(
                "UPDATE saved_queries
                 SET name = ?1, description = ?2, query_text = ?3, connection_id = ?4,
                     tags = ?5, category = ?6, updated_at = ?7, favorite = ?8, is_snippet = ?9, is_system = ?10, language = ?11, folder_id = ?12
                 WHERE id = ?13",
                (
                    &query.name,
                    &query.description,
                    &query.query_text,
                    &query.connection_id.map(|id| id.to_string()),
                    &query.tags,
                    &query.category,
                    now,
                    query.favorite,
                    query.is_snippet,
                    query.is_system,
                    &query.language,
                    query.folder_id,
                    query.id,
                ),
            )
            .context("Failed to update saved query")?;
            Ok(query.id)
        }
    }

    pub fn get_saved_queries(&self, connection_id: Option<&Uuid>) -> Result<Vec<SavedQuery>> {
        let conn = self.conn.lock().unwrap();

        let mut queries = Vec::new();

        if let Some(conn_id) = connection_id {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, query_text, connection_id, tags, category, created_at, updated_at, favorite, is_snippet, is_system, language, folder_id
                 FROM saved_queries
                 WHERE connection_id = ?1 OR connection_id IS NULL
                 ORDER BY favorite DESC, created_at DESC"
            ).context("Failed to prepare saved queries statement")?;

            let rows = stmt
                .query_map([conn_id.to_string()], |row| {
                    Ok(SavedQuery {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        query_text: row.get(3)?,
                        connection_id: {
                            let id: Option<String> = row.get(4)?;
                            match id {
                                Some(id) => Some(Uuid::parse_str(&id).map_err(|err| {
                                    rusqlite::Error::FromSqlConversionFailure(
                                        0,
                                        Type::Text,
                                        Box::new(err),
                                    )
                                })?),
                                None => None,
                            }
                        },
                        tags: row.get(5)?,
                        category: row.get(6)?,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                        favorite: row.get(9)?,
                        is_snippet: row.get(10)?,
                        is_system: row.get(11)?,
                        language: row.get(12)?,
                        folder_id: row.get(13)?,
                    })
                })
                .context("Failed to query saved queries")?;

            for row in rows {
                queries.push(row.context("Failed to process saved query row")?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, query_text, connection_id, tags, category, created_at, updated_at, favorite, is_snippet, is_system, language, folder_id
                 FROM saved_queries
                 ORDER BY favorite DESC, created_at DESC"
            ).context("Failed to prepare saved queries statement")?;

            let rows = stmt
                .query_map([], |row| {
                    Ok(SavedQuery {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        query_text: row.get(3)?,
                        connection_id: {
                            let id: Option<String> = row.get(4)?;
                            match id {
                                Some(id) => Some(Uuid::parse_str(&id).map_err(|err| {
                                    rusqlite::Error::FromSqlConversionFailure(
                                        0,
                                        Type::Text,
                                        Box::new(err),
                                    )
                                })?),
                                None => None,
                            }
                        },
                        tags: row.get(5)?,
                        category: row.get(6)?,
                        created_at: row.get(7)?,
                        updated_at: row.get(8)?,
                        favorite: row.get(9)?,
                        is_snippet: row.get(10)?,
                        is_system: row.get(11)?,
                        language: row.get(12)?,
                        folder_id: row.get(13)?,
                    })
                })
                .context("Failed to query saved queries")?;

            for row in rows {
                queries.push(row.context("Failed to process saved query row")?);
            }
        }

        Ok(queries)
    }

    pub fn delete_saved_query(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM saved_queries WHERE id = ?1", [id])
            .context("Failed to delete saved query")?;
        Ok(())
    }
}

use std::time::Instant;
use anyhow::Context;
use dashmap::DashMap;
use uuid::Uuid;
use serde_json::value::RawValue;

use crate::{
    database::{
        stmt_manager::StatementManager,
        types::DatabaseConnection,
    },
    error::Error,
    storage::{Storage, QueryHistoryEntry, SavedQuery, ConnectionHistoryEntry},
};

pub struct QueryService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub storage: &'a Storage,
    pub stmt_manager: &'a StatementManager,
}

impl<'a> QueryService<'a> {
    pub async fn save_script(
        &self,
        name: String,
        content: String,
        connection_id: Option<Uuid>,
        description: Option<String>,
    ) -> Result<i64, Error> {
        let script = SavedQuery {
            id: 0,
            name,
            description,
            query_text: content,
            connection_id,
            tags: None,
            created_at: 0,
            updated_at: 0,
            favorite: false,
        };

        let script_id = self.storage.save_query(&script)?;
        Ok(script_id)
    }

    pub async fn update_script(
        &self,
        id: i64,
        name: String,
        content: String,
        connection_id: Option<Uuid>,
        description: Option<String>,
    ) -> Result<(), Error> {
        let script = SavedQuery {
            id,
            name,
            description,
            query_text: content,
            connection_id,
            tags: None,
            created_at: 0,
            updated_at: 0,
            favorite: false,
        };

        self.storage.save_query(&script)?;
        Ok(())
    }

    pub async fn get_scripts(
        &self,
        connection_id: Option<Uuid>,
    ) -> Result<Vec<SavedQuery>, Error> {
        let scripts = self.storage.get_saved_queries(connection_id.as_ref())?;
        Ok(scripts)
    }

    pub async fn delete_script(&self, id: i64) -> Result<(), Error> {
        self.storage.delete_saved_query(id)?;
        Ok(())
    }

    pub async fn save_session_state(&self, session_data: &str) -> Result<(), Error> {
        self.storage.set_setting("session_state", session_data)?;
        Ok(())
    }

    pub async fn get_session_state(&self) -> Result<Option<String>, Error> {
        let session_data = self.storage.get_setting("session_state")?;
        Ok(session_data)
    }

    pub async fn get_setting(&self, key: String) -> Result<Option<String>, Error> {
        self.storage.get_setting(&key).map_err(Into::into)
    }

    pub async fn set_setting(&self, key: String, value: String) -> Result<(), Error> {
        self.storage.set_setting(&key, &value)?;
        Ok(())
    }

    pub async fn get_connection_history(
        &self,
        db_type_filter: Option<String>,
        success_filter: Option<bool>,
        limit: Option<i64>,
    ) -> Result<Vec<ConnectionHistoryEntry>, Error> {
        self.storage
            .get_connection_history(db_type_filter.as_deref(), success_filter, limit)
    }

    pub async fn get_recent_queries(
        &self,
        connection_id: Option<String>,
        limit: Option<u32>,
        status_filter: Option<String>,
    ) -> Result<Vec<QueryHistoryEntry>, Error> {
        let entries = if let Some(conn_id) = connection_id {
            self.storage.get_query_history(&conn_id, limit.map(|l| l as i64))?
        } else {
            self.storage.get_query_history("", limit.map(|l| l as i64))?
        };

        let filtered = if let Some(status) = status_filter {
            entries.into_iter()
                .filter(|e| e.status == status)
                .collect()
        } else {
            entries
        };

        Ok(filtered)
    }

    pub async fn start_query(
        &self,
        connection_id: Uuid,
        query: &str,
    ) -> Result<Vec<usize>, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();

        let client = connection.get_client()?;
        let query_ids = self.stmt_manager.submit_query(client, query)?;

        Ok(query_ids)
    }

    pub async fn fetch_query(&self, query_id: usize) -> Result<crate::database::types::StatementInfo, Error> {
        self.stmt_manager.fetch_query(query_id)
    }

    pub async fn fetch_page(
        &self,
        query_id: usize,
        page_index: usize,
    ) -> Result<Option<Box<RawValue>>, Error> {
        let now = Instant::now();
        let page = self.stmt_manager.fetch_page(query_id, page_index)?;
        let elapsed = now.elapsed();
        log::info!("Took {}us to get page {page_index}", elapsed.as_micros());

        Ok(page)
    }

    pub async fn get_query_status(&self, query_id: usize) -> Result<crate::database::types::QueryStatus, Error> {
        self.stmt_manager.get_query_status(query_id)
    }

    pub async fn get_page_count(&self, query_id: usize) -> Result<usize, Error> {
        self.stmt_manager.get_page_count(query_id)
    }

    pub async fn get_columns(&self, query_id: usize) -> Result<Option<Box<RawValue>>, Error> {
        self.stmt_manager.get_columns(query_id)
    }

    pub async fn save_query_to_history(
        &self,
        connection_id: String,
        query: String,
        duration_ms: Option<u64>,
        status: String,
        row_count: u64,
        error_message: Option<String>,
    ) -> Result<(), Error> {
        let entry = QueryHistoryEntry {
            id: 0,
            connection_id,
            query_text: query,
            executed_at: chrono::Utc::now().timestamp(),
            duration_ms: duration_ms.map(|d| d as i64),
            status,
            row_count: row_count as i64,
            error_message,
        };

        self.storage.save_query_history(&entry)?;
        Ok(())
    }

    pub async fn get_query_history(
        &self,
        connection_id: String,
        limit: Option<u32>,
    ) -> Result<Vec<QueryHistoryEntry>, Error> {
        self.storage
            .get_query_history(&connection_id, limit.map(|l| l as i64))
    }
}

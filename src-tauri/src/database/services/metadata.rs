use std::sync::Arc;
use anyhow::{Context, anyhow};
use dashmap::DashMap;
use uuid::Uuid;

use crate::{
    database::{
        postgres, sqlite,
        types::{Database, DatabaseConnection, DatabaseSchema},
        metadata::{self, DatabaseMetadata},
    },
    error::Error,
};

pub struct MetadataService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub schemas: &'a DashMap<Uuid, Arc<DatabaseSchema>>,
}

impl<'a> MetadataService<'a> {
    pub async fn get_database_schema(
        &self,
        connection_id: Uuid,
    ) -> Result<Arc<DatabaseSchema>, Error> {
        if let Some(schema) = self.schemas.get(&connection_id) {
            return Ok(schema.clone());
        }

        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();

        let schema = match &connection.database {
            Database::Postgres {
                client: Some(client),
                ..
            } => postgres::schema::get_database_schema(client).await?,
            Database::Postgres { client: None, .. } => {
                return Err(Error::Any(anyhow!("Postgres connection not active")))
            }
            Database::SQLite {
                connection: Some(conn),
                ..
            } => sqlite::schema::get_database_schema(Arc::clone(conn)).await?,
            Database::SQLite {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("SQLite connection not active"))),
            Database::LibSQL {
                connection: Some(conn),
                ..
            } => crate::database::libsql::schema::get_database_schema(Arc::clone(conn)).await?,
            Database::LibSQL {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("LibSQL connection not active"))),
        };

        let schema = Arc::new(schema);
        self.schemas.insert(connection_id, schema.clone());

        Ok(schema)
    }

    pub async fn get_database_metadata(
        &self,
        connection_id: Uuid,
    ) -> Result<DatabaseMetadata, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value();

        match &connection.database {
            Database::Postgres {
                connection_string,
                client: Some(client),
            } => {
                metadata::get_postgres_metadata(client, connection_string).await
            }
            Database::Postgres { client: None, .. } => {
                Err(Error::Any(anyhow!("Postgres connection not active")))
            }
            Database::SQLite {
                db_path,
                connection: Some(conn),
            } => {
                let mut meta = metadata::get_sqlite_metadata(db_path)?;
                let conn_guard = conn.lock().unwrap();
                let (table_count, row_count) = metadata::get_sqlite_counts(&conn_guard)?;
                meta.table_count = table_count;
                meta.row_count_total = row_count;
                Ok(meta)
            }
            Database::SQLite { connection: None, .. } => {
                Err(Error::Any(anyhow!("SQLite connection not active")))
            }
            Database::LibSQL {
                url,
                connection: Some(conn),
                ..
            } => {
                metadata::get_libsql_metadata(conn, url).await
            }
            Database::LibSQL { connection: None, .. } => {
                Err(Error::Any(anyhow!("LibSQL connection not active")))
            }
        }
    }
}

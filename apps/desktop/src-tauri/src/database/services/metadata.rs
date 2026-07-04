use anyhow::{anyhow, Context};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    database::{
        metadata::{self, DatabaseMetadata},
        postgres, sqlite,
        types::{Database, DatabaseConnection, DatabaseSchema},
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
            // TODO(dialect-parity, #89): CockroachDB shares the Postgres
            // introspection path. Some Postgres catalog queries differ on
            // CockroachDB; the `dialect` field is now threaded into
            // `get_database_schema` so Phase 2 can branch there. Until then the
            // vanilla Postgres query is the safe default.
            Database::Postgres {
                client: Some(client),
                dialect,
                ..
            } => postgres::schema::get_database_schema(client, *dialect).await?,
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
            Database::DuckDB {
                connection: Some(conn),
                ..
            } => conn.get_schema().await?,
            Database::DuckDB {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("DuckDB connection not active"))),
            Database::LibSQL {
                connection: Some(conn),
                ..
            } => crate::database::libsql::schema::get_database_schema(Arc::clone(conn)).await?,
            Database::LibSQL {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("LibSQL connection not active"))),
            Database::D1 {
                connection: Some(http),
                ..
            } => crate::database::d1::schema::get_database_schema(http).await?,
            Database::D1 {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("Cloudflare D1 connection not active"))),
            Database::Posthog {
                connection: Some(http),
                ..
            } => crate::database::posthog::schema::get_database_schema(http).await?,
            Database::Posthog {
                connection: None, ..
            } => return Err(Error::Any(anyhow!("PostHog connection not active"))),
            // TODO(dialect-parity, #88): MariaDB shares the MySQL introspection
            // path. MariaDB-specific types (UUID, INET4/INET6) and some
            // information_schema differences need a dialect branch; the
            // `dialect` field is now threaded into `get_database_schema` plus the
            // row-writer for the write path. Deferred; the vanilla MySQL query
            // remains the safe default.
            Database::MySQL {
                pool: Some(pool),
                dialect,
                ..
            } => crate::database::mysql::schema::get_database_schema(pool.clone(), *dialect).await?,
            Database::MySQL { pool: None, .. } => {
                return Err(Error::Any(anyhow!("MySQL connection not active")))
            }
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
                ..
            } => metadata::get_postgres_metadata(client, connection_string).await,
            Database::Postgres { client: None, .. } => {
                Err(Error::Any(anyhow!("Postgres connection not active")))
            }
            Database::SQLite {
                db_path,
                connection: Some(conn),
            } => {
                let mut meta = metadata::get_sqlite_metadata(db_path)?;
                let conn_guard = conn
                    .lock()
                    .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
                let (table_count, row_count) = metadata::get_sqlite_counts(&conn_guard)?;
                meta.table_count = table_count;
                meta.row_count_total = row_count;
                Ok(meta)
            }
            Database::SQLite {
                connection: None, ..
            } => Err(Error::Any(anyhow!("SQLite connection not active"))),
            Database::DuckDB {
                db_path,
                connection: Some(conn),
                ..
            } => {
                // File-stat based metadata works for any file-backed database
                let mut meta = metadata::get_sqlite_metadata(db_path)?;
                let (table_count, row_count) = conn.get_counts().await?;
                meta.table_count = table_count;
                meta.row_count_total = row_count;
                Ok(meta)
            }
            Database::DuckDB {
                connection: None, ..
            } => Err(Error::Any(anyhow!("DuckDB connection not active"))),
            Database::LibSQL {
                url,
                connection: Some(conn),
                ..
            } => metadata::get_libsql_metadata(conn, url).await,
            Database::LibSQL {
                connection: None, ..
            } => Err(Error::Any(anyhow!("LibSQL connection not active"))),
            Database::D1 {
                url,
                connection: Some(http),
            } => metadata::get_d1_metadata(http, url).await,
            Database::D1 {
                connection: None, ..
            } => Err(Error::Any(anyhow!("Cloudflare D1 connection not active"))),
            Database::Posthog {
                url,
                connection: Some(http),
            } => metadata::get_posthog_metadata(http, url).await,
            Database::Posthog {
                connection: None, ..
            } => Err(Error::Any(anyhow!("PostHog connection not active"))),
            Database::MySQL {
                connection_string,
                pool: Some(pool),
                ..
            } => metadata::get_mysql_metadata(pool, connection_string).await,
            Database::MySQL { pool: None, .. } => {
                Err(Error::Any(anyhow!("MySQL connection not active")))
            }
        }
    }
}

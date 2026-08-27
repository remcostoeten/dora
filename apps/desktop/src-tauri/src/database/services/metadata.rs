use anyhow::{anyhow, Context};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    database::{
        dialect::{MySqlDialect, PgDialect},
        metadata::{self, DatabaseMetadata},
        postgres, sqlite,
        types::{Database, DatabaseConnection, DatabaseSchema},
    },
    error::Error,
};

pub struct MetadataService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub schemas: &'a DashMap<Uuid, Arc<DatabaseSchema>>,
    pub schema_locks: &'a DashMap<Uuid, Arc<tokio::sync::Mutex<()>>>,
}

/// A cloned engine handle for one introspection run. Cloning out of the
/// connections map lets the `DashMap` `Ref` drop before any await, so a slow
/// introspection can never block writers to the connections map.
enum IntrospectTarget {
    Postgres {
        client: Arc<tokio_postgres::Client>,
        dialect: PgDialect,
    },
    Sqlite(Arc<std::sync::Mutex<rusqlite::Connection>>),
    DuckDb(Arc<dyn crate::database::duckdb_backend::DuckDbConn>),
    LibSql(Arc<libsql::Connection>),
    D1(Arc<crate::database::d1::D1Http>),
    Posthog(Arc<crate::database::posthog::PosthogHttp>),
    MySql {
        pool: Arc<mysql_async::Pool>,
        dialect: MySqlDialect,
    },
}

impl<'a> MetadataService<'a> {
    fn introspect_target(&self, connection_id: Uuid) -> Result<IntrospectTarget, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        match &connection_entry.value().database {
            // TODO(dialect-parity, #89): CockroachDB shares the Postgres
            // introspection path. Some Postgres catalog queries differ on
            // CockroachDB; the `dialect` field is now threaded into
            // `get_database_schema` so Phase 2 can branch there. Until then the
            // vanilla Postgres query is the safe default.
            Database::Postgres {
                client: Some(client),
                dialect,
                ..
            } => Ok(IntrospectTarget::Postgres {
                client: Arc::clone(client),
                dialect: *dialect,
            }),
            Database::Postgres { client: None, .. } => {
                Err(Error::Any(anyhow!("Postgres connection not active")))
            }
            Database::SQLite {
                connection: Some(conn),
                ..
            } => Ok(IntrospectTarget::Sqlite(Arc::clone(conn))),
            Database::SQLite {
                connection: None, ..
            } => Err(Error::Any(anyhow!("SQLite connection not active"))),
            Database::DuckDB {
                connection: Some(conn),
                ..
            } => Ok(IntrospectTarget::DuckDb(Arc::clone(conn))),
            Database::DuckDB {
                connection: None, ..
            } => Err(Error::Any(anyhow!("DuckDB connection not active"))),
            Database::LibSQL {
                connection: Some(conn),
                ..
            } => Ok(IntrospectTarget::LibSql(Arc::clone(conn))),
            Database::LibSQL {
                connection: None, ..
            } => Err(Error::Any(anyhow!("LibSQL connection not active"))),
            Database::D1 {
                connection: Some(http),
                ..
            } => Ok(IntrospectTarget::D1(Arc::clone(http))),
            Database::D1 {
                connection: None, ..
            } => Err(Error::Any(anyhow!("Cloudflare D1 connection not active"))),
            Database::Posthog {
                connection: Some(http),
                ..
            } => Ok(IntrospectTarget::Posthog(Arc::clone(http))),
            Database::Posthog {
                connection: None, ..
            } => Err(Error::Any(anyhow!("PostHog connection not active"))),
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
            } => Ok(IntrospectTarget::MySql {
                pool: Arc::clone(pool),
                dialect: *dialect,
            }),
            Database::MySQL { pool: None, .. } => {
                Err(Error::Any(anyhow!("MySQL connection not active")))
            }
        }
    }

    pub async fn get_database_schema(
        &self,
        connection_id: Uuid,
    ) -> Result<Arc<DatabaseSchema>, Error> {
        if let Some(schema) = self.schemas.get(&connection_id) {
            return Ok(schema.clone());
        }

        // Serialize introspections per connection: the loser of a concurrent
        // race waits here and then returns the winner's cached schema instead
        // of running the whole introspection a second time.
        let lock = self.schema_locks.entry(connection_id).or_default().clone();
        let _guard = lock.lock().await;

        if let Some(schema) = self.schemas.get(&connection_id) {
            return Ok(schema.clone());
        }

        let target = self.introspect_target(connection_id)?;

        let schema = match target {
            IntrospectTarget::Postgres { client, dialect } => {
                postgres::schema::get_database_schema(&client, dialect).await?
            }
            IntrospectTarget::Sqlite(conn) => sqlite::schema::get_database_schema(conn).await?,
            IntrospectTarget::DuckDb(conn) => conn.get_schema().await?,
            IntrospectTarget::LibSql(conn) => {
                crate::database::libsql::schema::get_database_schema(conn).await?
            }
            IntrospectTarget::D1(http) => {
                crate::database::d1::schema::get_database_schema(&http).await?
            }
            IntrospectTarget::Posthog(http) => {
                crate::database::posthog::schema::get_database_schema(&http).await?
            }
            IntrospectTarget::MySql { pool, dialect } => {
                crate::database::mysql::schema::get_database_schema(pool, dialect).await?
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

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use specta::Type;

use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::database::dialect::{MySqlDialect, PgDialect};
use crate::database::duckdb::file_source::DataFileSourceEntry;
use crate::database::ssh_tunnel::SshTunnel;
use crate::Error;

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseConnectResult {
    pub connected: bool,
    pub file_sources: Option<Vec<DataFileSourceEntry>>,
}

pub type QueryId = usize;

/// A row of data serialized by one of our writers
/// You can conceptually think of this as a Vec<Vec<Json>>.
///
/// Example:
/// - Query: `SELECT 1,2,3 UNION ALL SELECT 4,5,6`
/// - Page: `[[1,2,3],[4,5,6]]`
pub type Page = Box<RawValue>;

pub type ExecSender = UnboundedSender<QueryExecEvent>;

/// True when a Postgres connection should skip named prepared statements.
///
/// Explicit URL options are preferred because every provider/pooler has
/// slightly different support. Heuristics are intentionally limited to hosts or
/// ports that clearly look like a pooler.
pub fn detect_pgbouncer_flag(connection_string: &str) -> bool {
    let Ok(url) = url::Url::parse(connection_string) else {
        return false;
    };

    if url.query_pairs().any(is_simple_query_option) {
        return true;
    }

    is_postgres_pooler_url(&url)
}

pub fn is_postgres_pooler_url(url: &url::Url) -> bool {
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    host.contains("pgbouncer")
        || host.contains("pooler")
        || host.contains("-pooler.")
        || matches!(url.port(), Some(6432 | 6543))
}

fn is_simple_query_option(
    key_value: (std::borrow::Cow<'_, str>, std::borrow::Cow<'_, str>),
) -> bool {
    let (key, value) = key_value;
    let key = key.to_ascii_lowercase();
    let value = value.to_ascii_lowercase();

    matches!(key.as_str(), "pgbouncer" | "pooler" | "simple_query")
        && matches!(value.as_str(), "true" | "1" | "transaction" | "statement")
        || matches!(key.as_str(), "prepared_statements" | "prepared_statement")
            && matches!(value.as_str(), "false" | "0" | "disabled" | "disable")
        || matches!(
            key.as_str(),
            "statement_cache_size" | "statement_cache_capacity"
        ) && value == "0"
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct StatementInfo {
    pub returns_values: bool,
    pub status: QueryStatus,
    #[specta(type = serde_json::Value)]
    pub first_page: Option<Box<RawValue>>,
    pub affected_rows: Option<usize>,
    pub page_count: usize,
    pub rows_received: usize,
    pub error: Option<String>,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
pub enum QueryStatus {
    Pending = 0,
    Running = 1,
    Completed = 2,
    Error = 3,
}

impl From<u8> for QueryStatus {
    fn from(value: u8) -> Self {
        match value {
            0 => Self::Pending,
            1 => Self::Running,
            2 => Self::Completed,
            _ => Self::Error,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ConnectionInfo {
    pub id: Uuid,
    pub name: String,
    pub connected: bool,
    pub database_type: DatabaseInfo,
    pub last_connected_at: Option<i64>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub pin_hash: Option<String>,
    pub favorite: Option<bool>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub private_key_path: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum DatabaseInfo {
    Postgres {
        connection_string: String,
        ssh_config: Option<SshConfig>,
    },
    CockroachDB {
        connection_string: String,
        ssh_config: Option<SshConfig>,
    },
    MySQL {
        connection_string: String,
        ssh_config: Option<SshConfig>,
    },
    MariaDB {
        connection_string: String,
        ssh_config: Option<SshConfig>,
    },
    SQLite {
        db_path: String,
    },
    /// DuckDB database file (embedded, like SQLite).
    ///
    /// When `file_sources` is non-empty the connection is opened in-memory
    /// (`db_path` is `:memory:`) and each source file is registered as a
    /// read-only view — this is the "query a CSV/Parquet/JSON file" mode.
    DuckDB {
        db_path: String,
        #[serde(default)]
        file_sources: Vec<String>,
    },
    /// LibSQL/Turso database - can be local path or remote URL with auth token
    LibSQL {
        /// Either a local file path or remote URL (libsql://...)
        url: String,
        /// Auth token for remote connections (optional for local)
        auth_token: Option<String>,
    },
    /// Cloudflare D1 database, queried over the REST API (no SQL wire protocol).
    /// `url` is `d1://{account_id}/{database_id}`; the API token is loaded from
    /// the encrypted Cloudflare integration setting at connect time, so it is
    /// never persisted on the connection itself.
    D1 {
        url: String,
    },
    /// PostHog project, queried read-only over the HogQL Query API (no SQL wire
    /// protocol). `url` is `posthog://{region}/{project_id}`; the personal API
    /// key is loaded from the encrypted PostHog integration setting at connect
    /// time, so it is never persisted on the connection itself.
    Posthog {
        url: String,
    },
}

#[derive(Debug)]
pub struct DatabaseConnection {
    pub id: Uuid,
    pub name: String,
    pub connected: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub pin_hash: Option<String>,
    pub database: Database,
    /// Engine detected at connect time via `version()`. `None` until the
    /// connection has been opened and probed. This is *runtime-confirmed*
    /// information, distinct from the user's `Database` variant choice, and is
    /// the source of truth for dialect-specific capability gating.
    pub detected_dialect: Option<crate::database::dialect::DetectedDialect>,
}

#[derive(Clone)]
pub enum DatabaseClient {
    Postgres {
        client: Arc<tokio_postgres::Client>,
        use_simple_query: bool,
        /// Runtime dialect of this Postgres-wire connection (vanilla unless a
        /// CockroachDB server was detected). Threaded into adapters so schema
        /// introspection and row writers can branch per dialect.
        dialect: PgDialect,
    },
    MySQL {
        pool: Arc<mysql_async::Pool>,
        /// Runtime dialect of this MySQL-wire connection (vanilla unless a
        /// MariaDB server was detected).
        dialect: MySqlDialect,
    },
    SQLite {
        connection: Arc<Mutex<rusqlite::Connection>>,
    },
    DuckDB {
        connection: Arc<dyn crate::database::duckdb_backend::DuckDbConn>,
        /// True for file-source connections (CSV/Parquet/JSON views), which
        /// must refuse mutations.
        read_only: bool,
    },
    LibSQL {
        connection: Arc<libsql::Connection>,
    },
    /// Cloudflare D1 over HTTP. The `D1Http` holds the account/database ids and
    /// the bearer token and is cheap to clone (the inner `reqwest::Client` is an
    /// `Arc`), so it lives behind an `Arc` like the other driver handles.
    D1 {
        http: Arc<crate::database::d1::D1Http>,
    },
    /// PostHog over HTTP. The `PosthogHttp` holds the region/project and the
    /// personal API key; cheap to clone (the inner `reqwest::Client` is an
    /// `Arc`), so it lives behind an `Arc` like the other driver handles.
    Posthog {
        http: Arc<crate::database::posthog::PosthogHttp>,
    },
}

#[derive(Debug)]
pub enum Database {
    Postgres {
        connection_string: String,
        ssh_config: Option<SshConfig>,
        client: Option<Arc<tokio_postgres::Client>>,
        tunnel: Option<Arc<SshTunnel>>,
        /// When true, the execution path skips named prepared statements and
        /// uses the simple-query protocol instead. Detected from
        /// `?pgbouncer=true` in the connection string (Prisma-compatible flag).
        /// Required for PgBouncer in transaction-pool mode.
        use_simple_query: bool,
        /// Runtime dialect behind this Postgres-wire connection. Defaults to
        /// `Vanilla`; overwritten by `version()` detection at connect time and
        /// is the source of truth for dialect-specific capability gating
        /// (e.g. CockroachDB has no LISTEN/NOTIFY).
        dialect: PgDialect,
    },
    MySQL {
        connection_string: String,
        ssh_config: Option<SshConfig>,
        pool: Option<Arc<mysql_async::Pool>>,
        tunnel: Option<Arc<SshTunnel>>,
        /// Runtime dialect behind this MySQL-wire connection. Defaults to
        /// `Vanilla`; overwritten by `VERSION()` detection at connect time.
        dialect: MySqlDialect,
    },
    SQLite {
        db_path: String,
        connection: Option<Arc<Mutex<rusqlite::Connection>>>,
    },
    DuckDB {
        db_path: String,
        file_sources: Vec<String>,
        file_source_entries: Vec<DataFileSourceEntry>,
        connection: Option<Arc<dyn crate::database::duckdb_backend::DuckDbConn>>,
    },
    LibSQL {
        url: String,
        auth_token: Option<String>,
        connection: Option<Arc<libsql::Connection>>,
    },
    /// Cloudflare D1. `url` is `d1://{account_id}/{database_id}`. `connection`
    /// is `None` until `connect` loads the encrypted Cloudflare token and builds
    /// a `D1Http`.
    D1 {
        url: String,
        connection: Option<Arc<crate::database::d1::D1Http>>,
    },
    /// PostHog. `url` is `posthog://{region}/{project_id}`. `connection` is
    /// `None` until `connect` loads the encrypted PostHog API key and builds a
    /// `PosthogHttp`.
    Posthog {
        url: String,
        connection: Option<Arc<crate::database::posthog::PosthogHttp>>,
    },
}

impl DatabaseConnection {
    pub fn to_connection_info(&self) -> ConnectionInfo {
        ConnectionInfo {
            id: self.id,
            name: self.name.clone(),
            connected: self.connected,
            database_type: match &self.database {
                // The runtime `dialect` field maps back onto the stable
                // `DatabaseInfo` frontend contract: a CockroachDb/MariaDb
                // dialect surfaces as the corresponding `DatabaseInfo` variant,
                // everything else as the vanilla engine variant.
                Database::Postgres {
                    connection_string,
                    ssh_config,
                    dialect: PgDialect::CockroachDb,
                    ..
                } => DatabaseInfo::CockroachDB {
                    connection_string: connection_string.clone(),
                    ssh_config: ssh_config.clone(),
                },
                Database::Postgres {
                    connection_string,
                    ssh_config,
                    ..
                } => DatabaseInfo::Postgres {
                    connection_string: connection_string.clone(),
                    ssh_config: ssh_config.clone(),
                },
                Database::MySQL {
                    connection_string,
                    ssh_config,
                    dialect: MySqlDialect::MariaDb,
                    ..
                } => DatabaseInfo::MariaDB {
                    connection_string: connection_string.clone(),
                    ssh_config: ssh_config.clone(),
                },
                Database::MySQL {
                    connection_string,
                    ssh_config,
                    ..
                } => DatabaseInfo::MySQL {
                    connection_string: connection_string.clone(),
                    ssh_config: ssh_config.clone(),
                },
                Database::SQLite { db_path, .. } => DatabaseInfo::SQLite {
                    db_path: db_path.clone(),
                },
                Database::DuckDB {
                    db_path,
                    file_sources,
                    ..
                } => DatabaseInfo::DuckDB {
                    db_path: db_path.clone(),
                    file_sources: file_sources.clone(),
                },
                Database::LibSQL {
                    url, auth_token, ..
                } => DatabaseInfo::LibSQL {
                    url: url.clone(),
                    auth_token: auth_token.clone(),
                },
                Database::D1 { url, .. } => DatabaseInfo::D1 { url: url.clone() },
                Database::Posthog { url, .. } => DatabaseInfo::Posthog { url: url.clone() },
            },
            last_connected_at: None,
            created_at: Some(self.created_at),
            updated_at: Some(self.updated_at),
            pin_hash: self.pin_hash.clone(),
            favorite: None,
            color: None,
            sort_order: None,
        }
    }

    pub fn new(id: Uuid, name: String, database_info: DatabaseInfo) -> Self {
        let database = match database_info {
            DatabaseInfo::Postgres {
                connection_string,
                ssh_config,
            } => Database::Postgres {
                use_simple_query: detect_pgbouncer_flag(&connection_string),
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
                dialect: PgDialect::Postgres,
            },
            DatabaseInfo::CockroachDB {
                connection_string,
                ssh_config,
            } => Database::Postgres {
                use_simple_query: false,
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
                dialect: PgDialect::CockroachDb,
            },
            DatabaseInfo::MySQL {
                connection_string,
                ssh_config,
            } => Database::MySQL {
                connection_string,
                ssh_config,
                pool: None,
                tunnel: None,
                dialect: MySqlDialect::MySql,
            },
            DatabaseInfo::MariaDB {
                connection_string,
                ssh_config,
            } => Database::MySQL {
                connection_string,
                ssh_config,
                pool: None,
                tunnel: None,
                dialect: MySqlDialect::MariaDb,
            },
            DatabaseInfo::SQLite { db_path } => Database::SQLite {
                db_path,
                connection: None,
            },
            DatabaseInfo::DuckDB {
                db_path,
                file_sources,
            } => Database::DuckDB {
                db_path,
                file_sources,
                file_source_entries: Vec::new(),
                connection: None,
            },
            DatabaseInfo::LibSQL { url, auth_token } => Database::LibSQL {
                url,
                auth_token,
                connection: None,
            },
            DatabaseInfo::D1 { url } => Database::D1 {
                url,
                connection: None,
            },
            DatabaseInfo::Posthog { url } => Database::Posthog {
                url,
                connection: None,
            },
        };

        Self {
            id,
            name,
            connected: false,
            created_at: chrono::Utc::now().timestamp_millis(),
            updated_at: chrono::Utc::now().timestamp_millis(),
            pin_hash: None,
            database,
            detected_dialect: None,
        }
    }

    pub fn from_connection_info(info: ConnectionInfo) -> Self {
        let database = match info.database_type {
            DatabaseInfo::Postgres {
                connection_string,
                ssh_config,
            } => Database::Postgres {
                use_simple_query: detect_pgbouncer_flag(&connection_string),
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
                dialect: PgDialect::Postgres,
            },
            DatabaseInfo::CockroachDB {
                connection_string,
                ssh_config,
            } => Database::Postgres {
                use_simple_query: false,
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
                dialect: PgDialect::CockroachDb,
            },
            DatabaseInfo::MySQL {
                connection_string,
                ssh_config,
            } => Database::MySQL {
                connection_string,
                ssh_config,
                pool: None,
                tunnel: None,
                dialect: MySqlDialect::MySql,
            },
            DatabaseInfo::MariaDB {
                connection_string,
                ssh_config,
            } => Database::MySQL {
                connection_string,
                ssh_config,
                pool: None,
                tunnel: None,
                dialect: MySqlDialect::MariaDb,
            },
            DatabaseInfo::SQLite { db_path } => Database::SQLite {
                db_path,
                connection: None,
            },
            DatabaseInfo::DuckDB {
                db_path,
                file_sources,
            } => Database::DuckDB {
                db_path,
                file_sources,
                file_source_entries: Vec::new(),
                connection: None,
            },
            DatabaseInfo::LibSQL { url, auth_token } => Database::LibSQL {
                url,
                auth_token,
                connection: None,
            },
            DatabaseInfo::D1 { url } => Database::D1 {
                url,
                connection: None,
            },
            DatabaseInfo::Posthog { url } => Database::Posthog {
                url,
                connection: None,
            },
        };

        Self {
            id: info.id,
            name: info.name,
            connected: false,
            created_at: info
                .created_at
                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            updated_at: info
                .updated_at
                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            pin_hash: info.pin_hash,
            database,
            detected_dialect: None,
        }
    }

    /// Source capabilities for this connection.
    ///
    /// The per-engine `dialect` field is the source of truth: it defaults to
    /// `Vanilla` and is overwritten by `version()` detection at connect time,
    /// so caps follow the *runtime* engine rather than the user's variant pick.
    pub fn source_caps(&self) -> crate::database::dialect::SourceCaps {
        use crate::database::dialect::SourceCaps;
        match &self.database {
            Database::Postgres { dialect, .. } => dialect.caps(),
            Database::MySQL { dialect, .. } => dialect.caps(),
            // Non Postgres/MySQL engines do not use LISTEN/NOTIFY live monitoring.
            _ => SourceCaps {
                supports_listen_notify: false,
            },
        }
    }

    pub fn is_client_connected(&self) -> bool {
        match &self.database {
            Database::Postgres { client, .. } => client.is_some(),
            Database::MySQL { pool, .. } => pool.is_some(),
            Database::SQLite { connection, .. } => connection.is_some(),
            Database::DuckDB { connection, .. } => connection.is_some(),
            Database::LibSQL { connection, .. } => connection.is_some(),
            Database::D1 { connection, .. } => connection.is_some(),
            Database::Posthog { connection, .. } => connection.is_some(),
        }
    }

    /// Get the inner client object
    pub fn get_client(&self) -> Result<DatabaseClient, Error> {
        let client = match &self.database {
            Database::Postgres {
                client: Some(client),
                use_simple_query,
                dialect,
                ..
            } => DatabaseClient::Postgres {
                client: client.clone(),
                use_simple_query: *use_simple_query,
                dialect: *dialect,
            },
            Database::Postgres { client: None, .. } => {
                return Err(Error::Any(anyhow::anyhow!(
                    "Postgres connection not active"
                )));
            }
            Database::MySQL {
                pool: Some(pool),
                dialect,
                ..
            } => DatabaseClient::MySQL {
                pool: pool.clone(),
                dialect: *dialect,
            },
            Database::MySQL { pool: None, .. } => {
                return Err(Error::Any(anyhow::anyhow!("MySQL connection not active")));
            }
            Database::SQLite {
                connection: Some(sqlite_conn),
                ..
            } => DatabaseClient::SQLite {
                connection: sqlite_conn.clone(),
            },
            Database::SQLite {
                connection: None, ..
            } => {
                return Err(Error::Any(anyhow::anyhow!("SQLite connection not active")));
            }
            Database::DuckDB {
                connection: Some(duckdb_conn),
                file_sources,
                ..
            } => DatabaseClient::DuckDB {
                connection: duckdb_conn.clone(),
                read_only: !file_sources.is_empty(),
            },
            Database::DuckDB {
                connection: None, ..
            } => {
                return Err(Error::Any(anyhow::anyhow!("DuckDB connection not active")));
            }
            Database::LibSQL {
                connection: Some(libsql_conn),
                ..
            } => DatabaseClient::LibSQL {
                connection: libsql_conn.clone(),
            },
            Database::LibSQL {
                connection: None, ..
            } => {
                return Err(Error::Any(anyhow::anyhow!("LibSQL connection not active")));
            }
            Database::D1 {
                connection: Some(http),
                ..
            } => DatabaseClient::D1 { http: http.clone() },
            Database::D1 {
                connection: None, ..
            } => {
                return Err(Error::Any(anyhow::anyhow!(
                    "Cloudflare D1 connection not active"
                )));
            }
            Database::Posthog {
                connection: Some(http),
                ..
            } => DatabaseClient::Posthog { http: http.clone() },
            Database::Posthog {
                connection: None, ..
            } => {
                return Err(Error::Any(anyhow::anyhow!("PostHog connection not active")));
            }
        };

        Ok(client)
    }
}

/// Information about a foreign key relationship
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ForeignKeyInfo {
    /// The table that this foreign key references
    pub referenced_table: String,
    /// The column in the referenced table
    pub referenced_column: String,
    /// The schema of the referenced table (empty for SQLite)
    pub referenced_schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IndexInfo {
    pub name: String,
    pub column_names: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    /// Whether this column is part of the primary key
    #[serde(default)]
    pub is_primary_key: bool,
    /// Whether this column auto-increments (SERIAL, AUTOINCREMENT, etc.)
    #[serde(default)]
    pub is_auto_increment: bool,
    /// Foreign key relationship, if any
    #[serde(default)]
    pub foreign_key: Option<ForeignKeyInfo>,
    /// Closed set of values the database constrains this column to: a Postgres
    /// `enum` type's labels, or the literals in a `CHECK (col IN (...))`
    /// constraint. `None` when the column is unconstrained. The studio uses
    /// this to render a dropdown instead of a free-text cell editor.
    #[serde(default)]
    pub allowed_values: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub columns: Vec<ColumnInfo>,
    /// Names of columns that form the primary key (supports composite keys)
    #[serde(default)]
    pub primary_key_columns: Vec<String>,
    /// List of indexes on this table
    #[serde(default)]
    pub indexes: Vec<IndexInfo>,
    /// Estimated row count (may be approximate for performance)
    #[serde(default)]
    pub row_count_estimate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DatabaseSchema {
    pub tables: Vec<TableInfo>,
    pub schemas: Vec<String>,
    // Deduplicated list of column names across all tables, for autocomplete purposes
    pub unique_columns: Vec<String>,
}

pub fn channel() -> (
    UnboundedSender<QueryExecEvent>,
    UnboundedReceiver<QueryExecEvent>,
) {
    mpsc::unbounded_channel()
}

#[derive(Debug)]
/// An event sent by a query executor to the main thread
pub enum QueryExecEvent {
    /// Sent by a query executor when the column types of a query are now known
    TypesResolved {
        // Serialized Vec<String>, because I can't help myself
        columns: Box<RawValue>,
    },
    /// Sent by a query executor when a page of results is available
    Page {
        #[allow(unused)]
        page_amount: usize,
        /// JSON-serialized Vec<Vec<Json>>
        page: Page,
    },
    Finished {
        #[allow(unused)]
        elapsed_ms: u64,
        /// Number of rows affected by the query
        /// Relevant only for modification queries
        affected_rows: usize,
        /// If the query failed, this will contain the error message
        error: Option<String>,
    },
}

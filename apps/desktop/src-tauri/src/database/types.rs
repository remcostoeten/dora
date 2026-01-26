use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use specta::Type;

use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

use crate::database::ssh_tunnel::SshTunnel;
use crate::Error;

pub type QueryId = usize;

/// A row of data serialized by one of our writers
/// You can conceptually think of this as a Vec<Vec<Json>>.
///
/// Example:
/// - Query: `SELECT 1,2,3 UNION ALL SELECT 4,5,6`
/// - Page: `[[1,2,3],[4,5,6]]`
pub type Page = Box<RawValue>;

pub type ExecSender = UnboundedSender<QueryExecEvent>;

#[derive(Debug, Clone, Serialize, Type)]
pub struct StatementInfo {
    pub returns_values: bool,
    pub status: QueryStatus,
    #[specta(type = serde_json::Value)]
    pub first_page: Option<Box<RawValue>>,
    pub affected_rows: Option<usize>,
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    SQLite {
        db_path: String,
    },
    /// LibSQL/Turso database - can be local path or remote URL with auth token
    LibSQL {
        /// Either a local file path or remote URL (libsql://...)
        url: String,
        /// Auth token for remote connections (optional for local)
        auth_token: Option<String>,
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
}

#[derive(Clone)]
pub enum DatabaseClient {
    Postgres {
        client: Arc<tokio_postgres::Client>,
    },
    SQLite {
        connection: Arc<Mutex<rusqlite::Connection>>,
    },
    LibSQL {
        connection: Arc<libsql::Connection>,
    },
}

#[derive(Debug)]
pub enum Database {
    Postgres {
        connection_string: String,
        ssh_config: Option<SshConfig>,
        client: Option<Arc<tokio_postgres::Client>>,
        tunnel: Option<Arc<SshTunnel>>,
    },
    SQLite {
        db_path: String,
        connection: Option<Arc<Mutex<rusqlite::Connection>>>,
    },
    LibSQL {
        url: String,
        auth_token: Option<String>,
        connection: Option<Arc<libsql::Connection>>,
    },
}

impl DatabaseConnection {
    pub fn to_connection_info(&self) -> ConnectionInfo {
        ConnectionInfo {
            id: self.id,
            name: self.name.clone(),
            connected: self.connected,
            database_type: match &self.database {
                Database::Postgres {
                    connection_string,
                    ssh_config,
                    ..
                } => DatabaseInfo::Postgres {
                    connection_string: connection_string.clone(),
                    ssh_config: ssh_config.clone(),
                },
                Database::SQLite { db_path, .. } => DatabaseInfo::SQLite {
                    db_path: db_path.clone(),
                },
                Database::LibSQL {
                    url, auth_token, ..
                } => DatabaseInfo::LibSQL {
                    url: url.clone(),
                    auth_token: auth_token.clone(),
                },
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
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
            },
            DatabaseInfo::SQLite { db_path } => Database::SQLite {
                db_path,
                connection: None,
            },
            DatabaseInfo::LibSQL { url, auth_token } => Database::LibSQL {
                url,
                auth_token,
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
        }
    }

    pub fn from_connection_info(info: ConnectionInfo) -> Self {
        let database = match info.database_type {
            DatabaseInfo::Postgres { connection_string, ssh_config } => Database::Postgres {
                connection_string,
                ssh_config,
                client: None,
                tunnel: None,
            },
            DatabaseInfo::SQLite { db_path } => Database::SQLite {
                db_path,
                connection: None,
            },
            DatabaseInfo::LibSQL { url, auth_token } => Database::LibSQL {
                url,
                auth_token,
                connection: None,
            },
        };

        Self {
            id: info.id,
            name: info.name,
            connected: false,
            created_at: info.created_at.unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            updated_at: info.updated_at.unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
            pin_hash: info.pin_hash,
            database,
        }
    }

    pub fn is_client_connected(&self) -> bool {
        match &self.database {
            Database::Postgres { client, .. } => client.is_some(),
            Database::SQLite { connection, .. } => connection.is_some(),
            Database::LibSQL { connection, .. } => connection.is_some(),
        }
    }

    /// Get the inner client object
    pub fn get_client(&self) -> Result<DatabaseClient, Error> {
        let client = match &self.database {
            Database::Postgres {
                client: Some(client),
                ..
            } => DatabaseClient::Postgres {
                client: client.clone(),
            },
            Database::Postgres { client: None, .. } => {
                return Err(Error::Any(anyhow::anyhow!(
                    "Postgres connection not active"
                )));
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

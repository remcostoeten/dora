use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::{database::types::DatabaseInfo, Result};

// Must match the IDs in the database.
pub(super) const DB_TYPE_POSTGRES: i32 = 1;
pub(super) const DB_TYPE_SQLITE: i32 = 2;
pub(super) const DB_TYPE_LIBSQL: i32 = 3;
pub(super) const DB_TYPE_MYSQL: i32 = 4;
pub(super) const DB_TYPE_COCKROACH: i32 = 5;
pub(super) const DB_TYPE_MARIADB: i32 = 6;
pub(super) const DB_TYPE_DUCKDB: i32 = 7;

#[derive(Debug, Serialize, Deserialize)]
struct StoredPostgresConnection {
    connection_string: String,
    #[serde(default)]
    ssh_config: Option<crate::database::types::SshConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredLibsqlConnection {
    url: String,
    auth_token: Option<String>,
}

/// DuckDB persists as JSON so file-source connections can carry their list of
/// registered files. Legacy rows that stored a bare path string are still read
/// (see `deserialize_database_info`).
#[derive(Debug, Serialize, Deserialize)]
struct StoredDuckdbConnection {
    db_path: String,
    #[serde(default)]
    file_sources: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredMysqlConnection {
    connection_string: String,
    #[serde(default)]
    ssh_config: Option<crate::database::types::SshConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredPostgresLikeConnection {
    connection_string: String,
    #[serde(default)]
    ssh_config: Option<crate::database::types::SshConfig>,
}

pub(super) fn serialize_connection_data(database_type: &DatabaseInfo) -> Result<(i32, String)> {
    match database_type {
        DatabaseInfo::Postgres {
            connection_string,
            ssh_config,
        } => Ok((
            DB_TYPE_POSTGRES,
            serde_json::to_string(&StoredPostgresConnection {
                connection_string: connection_string.clone(),
                ssh_config: ssh_config.clone(),
            })
            .context("Failed to serialize Postgres connection data")?,
        )),
        DatabaseInfo::CockroachDB {
            connection_string,
            ssh_config,
        } => Ok((
            DB_TYPE_COCKROACH,
            serde_json::to_string(&StoredPostgresLikeConnection {
                connection_string: connection_string.clone(),
                ssh_config: ssh_config.clone(),
            })
            .context("Failed to serialize CockroachDB connection data")?,
        )),
        DatabaseInfo::SQLite { db_path } => Ok((DB_TYPE_SQLITE, db_path.clone())),
        DatabaseInfo::DuckDB {
            db_path,
            file_sources,
        } => Ok((
            DB_TYPE_DUCKDB,
            serde_json::to_string(&StoredDuckdbConnection {
                db_path: db_path.clone(),
                file_sources: file_sources.clone(),
            })
            .context("Failed to serialize DuckDB connection data")?,
        )),
        DatabaseInfo::LibSQL { url, auth_token } => Ok((
            DB_TYPE_LIBSQL,
            serde_json::to_string(&StoredLibsqlConnection {
                url: url.clone(),
                auth_token: auth_token.clone(),
            })
            .context("Failed to serialize LibSQL connection data")?,
        )),
        DatabaseInfo::MySQL {
            connection_string,
            ssh_config,
        } => Ok((
            DB_TYPE_MYSQL,
            serde_json::to_string(&StoredMysqlConnection {
                connection_string: connection_string.clone(),
                ssh_config: ssh_config.clone(),
            })
            .context("Failed to serialize MySQL connection data")?,
        )),
        DatabaseInfo::MariaDB {
            connection_string,
            ssh_config,
        } => Ok((
            DB_TYPE_MARIADB,
            serde_json::to_string(&StoredMysqlConnection {
                connection_string: connection_string.clone(),
                ssh_config: ssh_config.clone(),
            })
            .context("Failed to serialize MariaDB connection data")?,
        )),
    }
}

/// Maps a known `database_type_id` to its name. Returns `None` for ids we don't
/// recognise so callers can fall back to the joined `database_types.name`.
fn db_type_name_from_id(db_type_id: i32) -> Option<&'static str> {
    match db_type_id {
        DB_TYPE_POSTGRES => Some("postgres"),
        DB_TYPE_SQLITE => Some("sqlite"),
        DB_TYPE_LIBSQL => Some("libsql"),
        DB_TYPE_MYSQL => Some("mysql"),
        DB_TYPE_COCKROACH => Some("cockroach"),
        DB_TYPE_MARIADB => Some("mariadb"),
        DB_TYPE_DUCKDB => Some("duckdb"),
        _ => None,
    }
}

pub(super) fn deserialize_database_info(
    db_type: &str,
    db_type_id: i32,
    connection_data: String,
) -> DatabaseInfo {
    // `db_type_id` is written authoritatively by `serialize_connection_data`,
    // whereas `db_type` comes from a LEFT JOIN that silently yields the
    // 'postgres' COALESCE fallback when the `database_types` table is missing a
    // row. Prefer the id mapping so a missing seed row can't mis-decode a
    // connection as Postgres.
    let db_type = db_type_name_from_id(db_type_id).unwrap_or(if db_type.is_empty() {
        "postgres"
    } else {
        db_type
    });

    match db_type {
        "postgres" => {
            if let Ok(stored) = serde_json::from_str::<StoredPostgresConnection>(&connection_data) {
                DatabaseInfo::Postgres {
                    connection_string: stored.connection_string,
                    ssh_config: stored.ssh_config,
                }
            } else {
                DatabaseInfo::Postgres {
                    connection_string: connection_data,
                    ssh_config: None,
                }
            }
        }
        "sqlite" => DatabaseInfo::SQLite {
            db_path: connection_data,
        },
        "duckdb" => {
            if let Ok(stored) = serde_json::from_str::<StoredDuckdbConnection>(&connection_data) {
                DatabaseInfo::DuckDB {
                    db_path: stored.db_path,
                    file_sources: stored.file_sources,
                }
            } else {
                // Legacy rows stored a bare file path.
                DatabaseInfo::DuckDB {
                    db_path: connection_data,
                    file_sources: Vec::new(),
                }
            }
        }
        "libsql" => {
            if let Ok(stored) = serde_json::from_str::<StoredLibsqlConnection>(&connection_data) {
                DatabaseInfo::LibSQL {
                    url: stored.url,
                    auth_token: stored.auth_token,
                }
            } else {
                DatabaseInfo::LibSQL {
                    url: connection_data,
                    auth_token: None,
                }
            }
        }
        "cockroach" => {
            if let Ok(stored) =
                serde_json::from_str::<StoredPostgresLikeConnection>(&connection_data)
            {
                DatabaseInfo::CockroachDB {
                    connection_string: stored.connection_string,
                    ssh_config: stored.ssh_config,
                }
            } else {
                DatabaseInfo::CockroachDB {
                    connection_string: connection_data,
                    ssh_config: None,
                }
            }
        }
        "mysql" => {
            if let Ok(stored) = serde_json::from_str::<StoredMysqlConnection>(&connection_data) {
                DatabaseInfo::MySQL {
                    connection_string: stored.connection_string,
                    ssh_config: stored.ssh_config,
                }
            } else {
                DatabaseInfo::MySQL {
                    connection_string: connection_data,
                    ssh_config: None,
                }
            }
        }
        "mariadb" => {
            if let Ok(stored) = serde_json::from_str::<StoredMysqlConnection>(&connection_data) {
                DatabaseInfo::MariaDB {
                    connection_string: stored.connection_string,
                    ssh_config: stored.ssh_config,
                }
            } else {
                DatabaseInfo::MariaDB {
                    connection_string: connection_data,
                    ssh_config: None,
                }
            }
        }
        _ => DatabaseInfo::Postgres {
            connection_string: connection_data,
            ssh_config: None,
        },
    }
}

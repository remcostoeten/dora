use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::{database::types::DatabaseInfo, Result};

// Must match the IDs in the database.
pub(super) const DB_TYPE_POSTGRES: i32 = 1;
pub(super) const DB_TYPE_SQLITE: i32 = 2;
pub(super) const DB_TYPE_LIBSQL: i32 = 3;
pub(super) const DB_TYPE_MYSQL: i32 = 4;

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

#[derive(Debug, Serialize, Deserialize)]
struct StoredMysqlConnection {
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
        DatabaseInfo::SQLite { db_path } => Ok((DB_TYPE_SQLITE, db_path.clone())),
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
    }
}

fn db_type_from_id(db_type_id: i32) -> &'static str {
    match db_type_id {
        DB_TYPE_POSTGRES => "postgres",
        DB_TYPE_SQLITE => "sqlite",
        DB_TYPE_LIBSQL => "libsql",
        DB_TYPE_MYSQL => "mysql",
        _ => "postgres",
    }
}

pub(super) fn deserialize_database_info(
    db_type: &str,
    db_type_id: i32,
    connection_data: String,
) -> DatabaseInfo {
    let db_type = if db_type.is_empty() {
        db_type_from_id(db_type_id)
    } else {
        db_type
    };

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
        _ => DatabaseInfo::Postgres {
            connection_string: connection_data,
            ssh_config: None,
        },
    }
}

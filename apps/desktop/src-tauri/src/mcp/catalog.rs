use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    database::types::{detect_pgbouncer_flag, ConnectionInfo, DatabaseInfo},
    storage::{AgentConnectionKind, AgentPermission, KvConnectionInfo, Storage},
    Result,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ReadEnforcement {
    Engine,
    PolicyOnly,
    Api,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SqlFamily {
    Postgres,
    MySql,
    Sqlite,
    HogQl,
}

#[derive(Debug, Clone)]
pub struct AgentProfile {
    pub engine: &'static str,
    pub family: Option<SqlFamily>,
    pub read_enforcement: ReadEnforcement,
    pub can_write: bool,
    pub atomic_batches: bool,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentConnectionRow {
    pub id: Uuid,
    pub name: String,
    pub kind: AgentConnectionKind,
    pub engine: String,
    pub permission: Option<AgentPermission>,
    pub read_enforcement: ReadEnforcement,
    pub can_write: bool,
    pub unavailable_reason: Option<String>,
}

fn is_remote_libsql(url: &str) -> bool {
    let lowered = url.to_ascii_lowercase();
    ["libsql://", "http://", "https://", "ws://", "wss://"]
        .iter()
        .any(|scheme| lowered.starts_with(scheme))
}

fn postgres_profile(engine: &'static str, connection_string: &str) -> AgentProfile {
    AgentProfile {
        engine,
        family: Some(SqlFamily::Postgres),
        read_enforcement: if detect_pgbouncer_flag(connection_string) {
            ReadEnforcement::PolicyOnly
        } else {
            ReadEnforcement::Engine
        },
        can_write: true,
        atomic_batches: true,
        unavailable_reason: None,
    }
}

fn defaults_to_mysql_system_database(connection_string: &str) -> bool {
    let Ok(url) = url::Url::parse(connection_string) else {
        return true;
    };
    let database = url.path().trim_matches('/').to_ascii_lowercase();
    matches!(database.as_str(), "mysql" | "performance_schema" | "sys")
}

fn mysql_profile(engine: &'static str, connection_string: &str) -> AgentProfile {
    AgentProfile {
        engine,
        family: Some(SqlFamily::MySql),
        read_enforcement: ReadEnforcement::Engine,
        can_write: true,
        atomic_batches: true,
        unavailable_reason: defaults_to_mysql_system_database(connection_string)
            .then(|| "System databases are not available to agents".to_string()),
    }
}

/// @name profile_for_connection
/// @description Describes what agents can do on a saved SQL connection without
/// exposing any of its connection details.
///
/// @example
/// let profile = profile_for_connection(&info);
pub fn profile_for_connection(info: &ConnectionInfo) -> AgentProfile {
    let mut profile = match &info.database_type {
        DatabaseInfo::Postgres {
            connection_string, ..
        } => postgres_profile("postgres", connection_string),
        DatabaseInfo::CockroachDB {
            connection_string, ..
        } => postgres_profile("cockroachdb", connection_string),
        DatabaseInfo::MySQL {
            connection_string, ..
        } => mysql_profile("mysql", connection_string),
        DatabaseInfo::MariaDB {
            connection_string, ..
        } => mysql_profile("mariadb", connection_string),
        DatabaseInfo::SQLite { .. } => AgentProfile {
            engine: "sqlite",
            family: Some(SqlFamily::Sqlite),
            read_enforcement: ReadEnforcement::Engine,
            can_write: true,
            atomic_batches: true,
            unavailable_reason: None,
        },
        DatabaseInfo::DuckDB { .. } => AgentProfile {
            engine: "duckdb",
            family: None,
            read_enforcement: ReadEnforcement::Engine,
            can_write: false,
            atomic_batches: true,
            unavailable_reason: Some("Not available yet".to_string()),
        },
        DatabaseInfo::LibSQL { url, .. } => AgentProfile {
            engine: "libsql",
            family: Some(SqlFamily::Sqlite),
            read_enforcement: if is_remote_libsql(url) {
                ReadEnforcement::PolicyOnly
            } else {
                ReadEnforcement::Engine
            },
            can_write: true,
            atomic_batches: true,
            unavailable_reason: None,
        },
        DatabaseInfo::D1 { .. } => AgentProfile {
            engine: "d1",
            family: Some(SqlFamily::Sqlite),
            read_enforcement: ReadEnforcement::PolicyOnly,
            can_write: true,
            atomic_batches: false,
            unavailable_reason: None,
        },
        DatabaseInfo::Posthog { .. } => AgentProfile {
            engine: "posthog",
            family: Some(SqlFamily::HogQl),
            read_enforcement: ReadEnforcement::Api,
            can_write: false,
            atomic_batches: false,
            unavailable_reason: None,
        },
    };

    if info.pin_hash.is_some() {
        profile.unavailable_reason =
            Some("PIN-protected connections are not available to agents".to_string());
    }
    profile
}

/// @name list_agent_connection_rows
/// @description Lists every saved SQL and key-value connection with its agent
/// permission. Rows never contain hosts, paths, URLs or credentials.
///
/// @example
/// let rows = list_agent_connection_rows(&state.storage)?;
pub fn list_agent_connection_rows(storage: &Storage) -> Result<Vec<AgentConnectionRow>> {
    let mut rows = Vec::new();
    for info in storage.get_connections()? {
        let profile = profile_for_connection(&info);
        let permission = storage.agent_grant(&info.id, AgentConnectionKind::Sql)?;
        rows.push(AgentConnectionRow {
            id: info.id,
            name: info.name,
            kind: AgentConnectionKind::Sql,
            engine: profile.engine.to_string(),
            permission,
            read_enforcement: profile.read_enforcement,
            can_write: profile.can_write,
            unavailable_reason: profile.unavailable_reason,
        });
    }
    for info in storage.get_kv_connections()? {
        rows.push(kv_row(storage, info)?);
    }
    Ok(rows)
}

fn kv_row(storage: &Storage, info: KvConnectionInfo) -> Result<AgentConnectionRow> {
    let permission = storage.agent_grant(&info.id, AgentConnectionKind::Kv)?;
    Ok(AgentConnectionRow {
        id: info.id,
        name: info.name,
        kind: AgentConnectionKind::Kv,
        engine: "redis".to_string(),
        permission,
        read_enforcement: ReadEnforcement::Api,
        can_write: false,
        unavailable_reason: None,
    })
}

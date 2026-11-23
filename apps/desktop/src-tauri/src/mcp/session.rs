use std::time::Duration;

use mysql_async::prelude::Queryable;
use tokio_postgres::SimpleQueryMessage;

use super::{
    catalog::ReadEnforcement,
    errors::{McpErrorCode, McpFailure},
};
use crate::database::types::DatabaseClient;

pub const MYSQL_READ_ONLY_SETUP: &str = "SET SESSION TRANSACTION READ ONLY";

const POSTGRES_READ_ONLY_SETUP: &str = "SET default_transaction_read_only = on; SET statement_timeout = 60000; SET idle_in_transaction_session_timeout = 10000";

/// @name apply_read_only
/// @description Puts a freshly opened client into a read-only session and
/// verifies the setting. Returns the enforcement that actually applies.
///
/// @example
/// let enforcement = apply_read_only(&client, profile.read_enforcement).await?;
pub async fn apply_read_only(
    client: &DatabaseClient,
    expected: ReadEnforcement,
) -> Result<ReadEnforcement, String> {
    if expected != ReadEnforcement::Engine {
        return Ok(expected);
    }

    match client {
        DatabaseClient::Postgres {
            client,
            use_simple_query,
            ..
        } => {
            if *use_simple_query {
                return Ok(ReadEnforcement::PolicyOnly);
            }
            client
                .batch_execute(POSTGRES_READ_ONLY_SETUP)
                .await
                .map_err(|error| error.to_string())?;
            let messages = client
                .simple_query("SHOW default_transaction_read_only")
                .await
                .map_err(|error| error.to_string())?;
            let enabled = messages.iter().any(|message| {
                matches!(message, SimpleQueryMessage::Row(row) if row.get(0) == Some("on"))
            });
            verified(enabled)
        }
        DatabaseClient::MySQL { pool, .. } => {
            let mut connection = pool.get_conn().await.map_err(|error| error.to_string())?;
            let value = match connection
                .query_first::<i64, _>("SELECT @@SESSION.transaction_read_only")
                .await
            {
                Ok(value) => value,
                Err(_) => connection
                    .query_first::<i64, _>("SELECT @@SESSION.tx_read_only")
                    .await
                    .map_err(|error| error.to_string())?,
            };
            verified(value == Some(1))
        }
        DatabaseClient::SQLite { connection } => {
            let connection = connection
                .lock()
                .map_err(|_| "SQLite connection lock failed".to_string())?;
            connection
                .pragma_update(None, "query_only", true)
                .map_err(|error| error.to_string())?;
            connection
                .busy_timeout(Duration::from_millis(2000))
                .map_err(|error| error.to_string())?;
            let value: i64 = connection
                .pragma_query_value(None, "query_only", |row| row.get(0))
                .map_err(|error| error.to_string())?;
            verified(value == 1)
        }
        DatabaseClient::LibSQL { connection } => {
            connection
                .query("PRAGMA query_only = ON", ())
                .await
                .map_err(|error| error.to_string())?;
            let mut rows = connection
                .query("PRAGMA query_only", ())
                .await
                .map_err(|error| error.to_string())?;
            let row = rows.next().await.map_err(|error| error.to_string())?;
            let value = row.and_then(|row| row.get::<i64>(0).ok());
            verified(value == Some(1))
        }
        DatabaseClient::DuckDB { .. }
        | DatabaseClient::D1 { .. }
        | DatabaseClient::Posthog { .. } => Err("This engine has no read-only session".to_string()),
    }
}

/// @name ensure_builtin_functions
/// @description Refuses a Postgres call when a user-defined function shares an
/// allowlisted name, because overload resolution could select it.
///
/// @example
/// ensure_builtin_functions(&client, &approved.functions).await?;
pub async fn ensure_builtin_functions(
    client: &DatabaseClient,
    names: &[String],
) -> Result<(), McpFailure> {
    let DatabaseClient::Postgres { client, .. } = client else {
        return Ok(());
    };
    if names.is_empty() {
        return Ok(());
    }
    let list = names
        .iter()
        .map(|name| format!("'{}'", name.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT DISTINCT p.proname::text FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'crdb_internal') AND p.proname::text IN ({list})"
    );
    let messages = client.simple_query(&sql).await.map_err(|error| {
        log::warn!("Function identity check failed: {error}");
        McpFailure::new(
            McpErrorCode::FunctionNotAllowed,
            "Dora could not verify the functions in this statement.",
        )
    })?;
    let shadowed = messages.iter().find_map(|message| match message {
        SimpleQueryMessage::Row(row) => row.get(0),
        _ => None,
    });
    match shadowed {
        Some(name) => Err(McpFailure::new(
            McpErrorCode::FunctionNotAllowed,
            format!("The function '{name}' is overridden by a user-defined function."),
        )),
        None => Ok(()),
    }
}

fn verified(enabled: bool) -> Result<ReadEnforcement, String> {
    if enabled {
        Ok(ReadEnforcement::Engine)
    } else {
        Err("The server did not confirm the read-only session".to_string())
    }
}

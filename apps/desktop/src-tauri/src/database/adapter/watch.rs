//! Per-driver live-watch trait.
//!
//! The live monitor only needs a stable content fingerprint for a table. Driver
//! implementations own the database-specific scan and value normalization.

use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
};

use async_trait::async_trait;
use base64::Engine;
use mysql_async::{prelude::Queryable, Row as MySqlRow, Value as MySqlValue};
use rusqlite::types::ValueRef;

use super::read::{LibSqlAdapter, MySqlAdapter, PostgresAdapter, SqliteAdapter};
use crate::{database::postgres::row_writer::RowWriter as PostgresRowWriter, Error};

#[async_trait]
pub trait WatchAdapter: Send + Sync {
    async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error>;
}

#[async_trait]
impl WatchAdapter for PostgresAdapter {
    async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error> {
        let query = format!("SELECT * FROM {}", qualified_table(schema, table));
        let statement = self.client().prepare(&query).await?;
        let rows = self.client().query(&statement, &[]).await?;

        let mut row_values = Vec::with_capacity(rows.len());
        for row in &rows {
            let mut writer = PostgresRowWriter::new();
            writer.add_row(row)?;
            let value: serde_json::Value = serde_json::from_str(writer.finish().get())?;
            let values = value
                .as_array()
                .and_then(|rows| rows.first())
                .and_then(serde_json::Value::as_array)
                .cloned()
                .unwrap_or_default();
            row_values.push(serde_json::to_string(&values)?);
        }

        Ok(stable_hash_rows(row_values))
    }
}

#[async_trait]
impl WatchAdapter for SqliteAdapter {
    async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error> {
        let connection = self.connection().clone();
        let table = table.to_string();
        let schema = schema.map(str::to_string);

        tauri::async_runtime::spawn_blocking(move || {
            let conn = connection
                .lock()
                .map_err(|_| Error::Internal("SQLite connection lock poisoned".to_string()))?;
            let query = format!(
                "SELECT * FROM {}",
                qualified_table(schema.as_deref(), &table)
            );
            let mut statement = conn.prepare(&query)?;
            let column_count = statement.column_count();
            let mut rows = statement.query([])?;
            let mut row_values = Vec::new();

            while let Some(row) = rows.next()? {
                let mut values = Vec::with_capacity(column_count);
                for index in 0..column_count {
                    values.push(sqlite_value_to_json(row.get_ref(index)?));
                }
                row_values.push(serde_json::to_string(&values)?);
            }

            Ok(stable_hash_rows(row_values))
        })
        .await
        .map_err(|err| Error::Internal(format!("SQLite watch task failed: {err}")))?
    }
}

#[async_trait]
impl WatchAdapter for MySqlAdapter {
    async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error> {
        let mut conn = self.pool().get_conn().await?;
        let query = format!("SELECT * FROM {}", qualified_mysql_table(schema, table));
        let rows: Vec<MySqlRow> = conn.query(query).await?;

        let mut row_values = Vec::with_capacity(rows.len());
        for row in rows {
            let values = row
                .unwrap()
                .into_iter()
                .map(mysql_value_to_json)
                .collect::<Vec<_>>();
            row_values.push(serde_json::to_string(&values)?);
        }

        Ok(stable_hash_rows(row_values))
    }
}

#[async_trait]
impl WatchAdapter for LibSqlAdapter {
    async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error> {
        let query = format!("SELECT * FROM {}", qualified_table(schema, table));
        let mut rows = self
            .connection()
            .query(&query, ())
            .await
            .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL watch query failed: {}", err)))?;

        let column_count = rows.column_count() as usize;
        let mut row_values = Vec::new();
        while let Some(row) = rows
            .next()
            .await
            .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL watch row failed: {}", err)))?
        {
            let mut values = Vec::with_capacity(column_count);
            for index in 0..column_count {
                values.push(libsql_value_to_json(row.get_value(index as i32).map_err(
                    |err| Error::Any(anyhow::anyhow!("LibSQL watch value failed: {}", err)),
                )?));
            }
            row_values.push(serde_json::to_string(&values)?);
        }

        Ok(stable_hash_rows(row_values))
    }
}

pub type BoxedWatchAdapter = Box<dyn WatchAdapter>;

pub fn watch_adapter_from_client(
    client: &crate::database::types::DatabaseClient,
) -> BoxedWatchAdapter {
    match client {
        crate::database::types::DatabaseClient::Postgres { client } => {
            Box::new(PostgresAdapter::new(client.clone()))
        }
        crate::database::types::DatabaseClient::MySQL { pool } => {
            Box::new(MySqlAdapter::new(pool.clone()))
        }
        crate::database::types::DatabaseClient::SQLite { connection } => {
            Box::new(SqliteAdapter::new(connection.clone()))
        }
        crate::database::types::DatabaseClient::LibSQL { connection } => {
            Box::new(LibSqlAdapter::new(connection.clone()))
        }
    }
}

fn stable_hash_rows(mut rows: Vec<String>) -> u64 {
    rows.sort_unstable();

    let mut hasher = DefaultHasher::new();
    rows.hash(&mut hasher);
    hasher.finish()
}

fn qualified_table(schema: Option<&str>, table: &str) -> String {
    if let Some(schema) = schema {
        format!("{}.{}", quote_identifier(schema), quote_identifier(table))
    } else {
        quote_identifier(table)
    }
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn qualified_mysql_table(schema: Option<&str>, table: &str) -> String {
    if let Some(schema) = schema {
        format!(
            "{}.{}",
            quote_mysql_identifier(schema),
            quote_mysql_identifier(table)
        )
    } else {
        quote_mysql_identifier(table)
    }
}

fn quote_mysql_identifier(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> serde_json::Value {
    match value {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(value) => serde_json::Value::from(value),
        ValueRef::Real(value) => serde_json::Value::from(value),
        ValueRef::Text(value) => {
            serde_json::Value::from(String::from_utf8_lossy(value).to_string())
        }
        ValueRef::Blob(value) => {
            serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(value))
        }
    }
}

fn mysql_value_to_json(value: MySqlValue) -> serde_json::Value {
    match value {
        MySqlValue::NULL => serde_json::Value::Null,
        MySqlValue::Bytes(bytes) => {
            serde_json::Value::String(String::from_utf8_lossy(&bytes).to_string())
        }
        MySqlValue::Int(value) => serde_json::Value::from(value),
        MySqlValue::UInt(value) => serde_json::Value::from(value),
        MySqlValue::Float(value) => serde_json::Value::from(value),
        MySqlValue::Double(value) => serde_json::Value::from(value),
        MySqlValue::Date(year, month, day, hour, minute, second, micros) => {
            serde_json::Value::String(format!(
                "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{micros:06}"
            ))
        }
        MySqlValue::Time(is_negative, days, hours, minutes, seconds, micros) => {
            let sign = if is_negative { "-" } else { "" };
            serde_json::Value::String(format!(
                "{sign}{days} {hours:02}:{minutes:02}:{seconds:02}.{micros:06}"
            ))
        }
    }
}

fn libsql_value_to_json(value: libsql::Value) -> serde_json::Value {
    match value {
        libsql::Value::Null => serde_json::Value::Null,
        libsql::Value::Integer(value) => serde_json::Value::from(value),
        libsql::Value::Real(value) => serde_json::Value::from(value),
        libsql::Value::Text(value) => serde_json::Value::from(value),
        libsql::Value::Blob(value) => {
            serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(value))
        }
    }
}

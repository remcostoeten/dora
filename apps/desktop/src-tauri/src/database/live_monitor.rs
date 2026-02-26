use std::{collections::HashMap, sync::Arc, time::Duration};

use base64::Engine;
use dashmap::DashMap;
use rusqlite::types::ValueRef;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, EventTarget, Manager};
use uuid::Uuid;

use crate::{
    database::{postgres::row_writer::RowWriter as PostgresRowWriter, types::DatabaseClient},
    AppState, Error,
};

pub const LIVE_MONITOR_EVENT_NAME: &str = "live-monitor-update";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LiveMonitorChangeType {
    Insert,
    Update,
    Delete,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LiveMonitorChangeEvent {
    pub id: String,
    pub timestamp: i64,
    pub change_type: LiveMonitorChangeType,
    pub table_name: String,
    pub summary: String,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LiveMonitorUpdateEvent {
    pub monitor_id: String,
    pub connection_id: Uuid,
    pub table_name: String,
    pub polled_at: i64,
    pub events: Vec<LiveMonitorChangeEvent>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LiveMonitorSession {
    pub monitor_id: String,
    pub event_name: String,
}

struct MonitorTask {
    connection_id: Uuid,
    table_name: String,
    handle: JoinHandle<()>,
}

#[derive(Default)]
struct TableSnapshot {
    pk_columns: Vec<String>,
    rows_by_pk: HashMap<String, String>,
    row_counts: HashMap<String, usize>,
}

pub struct LiveMonitorManager {
    app: AppHandle,
    tasks: DashMap<String, MonitorTask>,
}

impl LiveMonitorManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            tasks: DashMap::new(),
        }
    }

    pub fn start_monitor(
        &self,
        connection_id: Uuid,
        table_name: String,
        interval_ms: u64,
        change_types: Vec<LiveMonitorChangeType>,
    ) -> Result<LiveMonitorSession, Error> {
        let monitor_id = Uuid::new_v4().to_string();
        let app = self.app.clone();
        let poll_interval_ms = interval_ms.max(1000);
        let subscribed_change_types = if change_types.is_empty() {
            vec![
                LiveMonitorChangeType::Insert,
                LiveMonitorChangeType::Update,
                LiveMonitorChangeType::Delete,
            ]
        } else {
            change_types
        };

        let connection_id_for_task = connection_id;
        let table_for_task = table_name.clone();
        let monitor_id_for_task = monitor_id.clone();
        let handle = tauri::async_runtime::spawn(async move {
            run_monitor_loop(
                app,
                monitor_id_for_task,
                connection_id_for_task,
                table_for_task,
                poll_interval_ms,
                subscribed_change_types,
            )
            .await;
        });

        self.tasks.insert(
            monitor_id.clone(),
            MonitorTask {
                connection_id,
                table_name,
                handle,
            },
        );

        Ok(LiveMonitorSession {
            monitor_id,
            event_name: LIVE_MONITOR_EVENT_NAME.to_string(),
        })
    }

    pub fn stop_monitor(&self, monitor_id: &str) {
        if let Some((_, task)) = self.tasks.remove(monitor_id) {
            task.handle.abort();
        }
    }

    pub fn stop_monitors_for_connection(&self, connection_id: Uuid) {
        let monitor_ids: Vec<String> = self
            .tasks
            .iter()
            .filter(|entry| entry.value().connection_id == connection_id)
            .map(|entry| entry.key().clone())
            .collect();

        for monitor_id in monitor_ids {
            self.stop_monitor(&monitor_id);
        }
    }

    pub fn stop_monitor_for_table(&self, connection_id: Uuid, table_name: &str) {
        let monitor_ids: Vec<String> = self
            .tasks
            .iter()
            .filter(|entry| {
                entry.value().connection_id == connection_id
                    && entry.value().table_name == table_name
            })
            .map(|entry| entry.key().clone())
            .collect();

        for monitor_id in monitor_ids {
            self.stop_monitor(&monitor_id);
        }
    }
}

async fn run_monitor_loop(
    app: AppHandle,
    monitor_id: String,
    connection_id: Uuid,
    table_name: String,
    interval_ms: u64,
    change_types: Vec<LiveMonitorChangeType>,
) {
    let mut previous_snapshot: Option<TableSnapshot> = None;
    let poll_interval = Duration::from_millis(interval_ms.max(1000));

    loop {
        let polled_at = chrono::Utc::now().timestamp_millis();
        let (events, error) = match fetch_table_snapshot(&app, connection_id, &table_name).await {
            Ok(current_snapshot) => {
                let events = if let Some(previous) = previous_snapshot.as_ref() {
                    diff_snapshots(previous, &current_snapshot, &table_name, &change_types)
                } else {
                    Vec::new()
                };

                previous_snapshot = Some(current_snapshot);
                (events, None)
            }
            Err(err) => (Vec::new(), Some(err.to_string())),
        };

        let payload = LiveMonitorUpdateEvent {
            monitor_id: monitor_id.clone(),
            connection_id,
            table_name: table_name.clone(),
            polled_at,
            events,
            error,
        };

        if let Err(err) = app.emit_to(EventTarget::App, LIVE_MONITOR_EVENT_NAME, payload) {
            log::error!("Failed to emit live monitor event: {}", err);
        }

        tokio::time::sleep(poll_interval).await;
    }
}

async fn fetch_table_snapshot(
    app: &AppHandle,
    connection_id: Uuid,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let client = {
        let Some(state) = app.try_state::<AppState>() else {
            return Err(Error::Any(anyhow::anyhow!("App state unavailable")));
        };
        let Some(connection_entry) = state.connections.get(&connection_id) else {
            return Err(Error::Any(anyhow::anyhow!(
                "Connection not found: {}",
                connection_id
            )));
        };
        connection_entry.value().get_client()?
    };

    match client {
        DatabaseClient::Postgres { client } => fetch_postgres_snapshot(client, table_name).await,
        DatabaseClient::SQLite { connection } => {
            fetch_sqlite_snapshot(connection, table_name).await
        }
        DatabaseClient::LibSQL { connection } => {
            fetch_libsql_snapshot(connection, table_name).await
        }
    }
}

async fn fetch_postgres_snapshot(
    client: Arc<tokio_postgres::Client>,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let quoted_table = quote_table_reference(table_name)?;
    let pk_columns = postgres_primary_key_columns(&client, &quoted_table).await?;

    let query = format!("SELECT * FROM {}", quoted_table);
    let statement = client.prepare(&query).await?;
    let column_names: Vec<String> = statement
        .columns()
        .iter()
        .map(|column| column.name().to_string())
        .collect();
    let rows = client.query(&statement, &[]).await?;

    let mut row_values = Vec::with_capacity(rows.len());
    for row in &rows {
        row_values.push(postgres_row_to_values(row)?);
    }

    Ok(build_snapshot(column_names, pk_columns, row_values))
}

fn postgres_row_to_values(row: &tokio_postgres::Row) -> Result<Vec<serde_json::Value>, Error> {
    let mut writer = PostgresRowWriter::new();
    writer.add_row(row)?;
    let json = writer.finish();
    let value: serde_json::Value = serde_json::from_str(json.get())?;
    let Some(values) = value
        .as_array()
        .and_then(|rows| rows.first())
        .and_then(serde_json::Value::as_array)
    else {
        return Ok(Vec::new());
    };
    Ok(values.to_vec())
}

async fn fetch_sqlite_snapshot(
    connection: Arc<std::sync::Mutex<rusqlite::Connection>>,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let table_name_owned = table_name.to_string();
    let handle = tokio::task::spawn_blocking(move || {
        let conn = connection
            .lock()
            .map_err(|_| Error::Any(anyhow::anyhow!("SQLite connection lock poisoned")))?;
        sqlite_snapshot_blocking(&conn, &table_name_owned)
    });

    handle
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("SQLite snapshot task failed: {}", err)))?
}

fn sqlite_snapshot_blocking(
    conn: &rusqlite::Connection,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let (schema, table) = split_table_reference(table_name)?;
    let quoted_table = quote_identifier(&table);
    let qualified_table = if let Some(ref schema_name) = schema {
        format!("{}.{}", quote_identifier(&schema_name), quoted_table)
    } else {
        quoted_table.clone()
    };

    let pk_columns = sqlite_primary_key_columns(conn, &schema, &table)?;
    let query = format!("SELECT * FROM {}", qualified_table);
    let mut statement = conn.prepare(&query)?;
    let column_names: Vec<String> = statement
        .column_names()
        .iter()
        .map(|name| (*name).to_string())
        .collect();

    let mut rows = statement.query([])?;
    let mut row_values = Vec::new();

    while let Some(row) = rows.next()? {
        let mut values = Vec::with_capacity(column_names.len());
        for index in 0..column_names.len() {
            let value = match row.get_ref(index)? {
                ValueRef::Null => serde_json::Value::Null,
                ValueRef::Integer(value) => serde_json::Value::from(value),
                ValueRef::Real(value) => serde_json::Value::from(value),
                ValueRef::Text(value) => {
                    let text = String::from_utf8_lossy(value).to_string();
                    serde_json::Value::from(text)
                }
                ValueRef::Blob(value) => {
                    serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(value))
                }
            };
            values.push(value);
        }
        row_values.push(values);
    }

    Ok(build_snapshot(column_names, pk_columns, row_values))
}

fn sqlite_primary_key_columns(
    conn: &rusqlite::Connection,
    schema: &Option<String>,
    table: &str,
) -> Result<Vec<String>, Error> {
    let pragma_query = if let Some(schema_name) = schema {
        format!(
            "PRAGMA {}.table_info({})",
            quote_identifier(schema_name),
            quote_identifier(table)
        )
    } else {
        format!("PRAGMA table_info({})", quote_identifier(table))
    };

    let mut pragma_statement = conn.prepare(&pragma_query)?;
    let mut pragma_rows = pragma_statement.query([])?;
    let mut primary_keys = Vec::new();

    while let Some(row) = pragma_rows.next()? {
        let name: String = row.get(1)?;
        let pk_order: i64 = row.get(5)?;
        if pk_order > 0 {
            primary_keys.push((pk_order, name));
        }
    }

    primary_keys.sort_by_key(|(order, _)| *order);
    Ok(primary_keys.into_iter().map(|(_, name)| name).collect())
}

async fn fetch_libsql_snapshot(
    connection: Arc<libsql::Connection>,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let (schema, table) = split_table_reference(table_name)?;
    let quoted_table = quote_identifier(&table);
    let qualified_table = if let Some(schema_name) = schema {
        format!("{}.{}", quote_identifier(&schema_name), quoted_table)
    } else {
        quoted_table.clone()
    };

    let pk_columns = libsql_primary_key_columns(&connection, &table).await?;
    let query = format!("SELECT * FROM {}", qualified_table);
    let mut rows = connection
        .query(&query, ())
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL query failed: {}", err)))?;

    let column_count = rows.column_count() as usize;
    let mut column_names = Vec::with_capacity(column_count);
    for index in 0..column_count {
        column_names.push(rows.column_name(index as i32).unwrap_or("?").to_string());
    }

    let mut row_values = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL row fetch failed: {}", err)))?
    {
        let mut values = Vec::with_capacity(column_count);
        for index in 0..column_count {
            let value = row
                .get_value(index as i32)
                .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL value read failed: {}", err)))?;
            values.push(match value {
                libsql::Value::Null => serde_json::Value::Null,
                libsql::Value::Integer(value) => serde_json::Value::from(value),
                libsql::Value::Real(value) => serde_json::Value::from(value),
                libsql::Value::Text(value) => serde_json::Value::from(value),
                libsql::Value::Blob(value) => {
                    serde_json::Value::from(base64::engine::general_purpose::STANDARD.encode(value))
                }
            });
        }
        row_values.push(values);
    }

    Ok(build_snapshot(column_names, pk_columns, row_values))
}

async fn libsql_primary_key_columns(
    connection: &libsql::Connection,
    table: &str,
) -> Result<Vec<String>, Error> {
    let pragma_query = format!("PRAGMA table_info({})", quote_identifier(table));
    let mut rows = connection
        .query(&pragma_query, ())
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL pragma failed: {}", err)))?;

    let mut primary_keys = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL pragma row failed: {}", err)))?
    {
        let name = match row
            .get_value(1)
            .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL pragma name read failed: {}", err)))?
        {
            libsql::Value::Text(value) => value,
            libsql::Value::Integer(value) => value.to_string(),
            libsql::Value::Real(value) => value.to_string(),
            libsql::Value::Blob(value) => {
                base64::engine::general_purpose::STANDARD.encode(value)
            }
            libsql::Value::Null => String::new(),
        };

        let pk_order = match row
            .get_value(5)
            .map_err(|err| Error::Any(anyhow::anyhow!("LibSQL pragma pk read failed: {}", err)))?
        {
            libsql::Value::Integer(value) => value,
            _ => 0,
        };

        if pk_order > 0 {
            primary_keys.push((pk_order, name));
        }
    }

    primary_keys.sort_by_key(|(order, _)| *order);
    Ok(primary_keys.into_iter().map(|(_, name)| name).collect())
}

async fn postgres_primary_key_columns(
    client: &tokio_postgres::Client,
    table_regclass: &str,
) -> Result<Vec<String>, Error> {
    const QUERY: &str = r#"
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
          AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum)
    "#;

    let rows = client.query(QUERY, &[&table_regclass]).await?;
    Ok(rows
        .iter()
        .filter_map(|row| row.try_get::<usize, String>(0).ok())
        .collect())
}

fn build_snapshot(
    column_names: Vec<String>,
    pk_columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
) -> TableSnapshot {
    let mut rows_by_pk = HashMap::new();
    let mut row_counts: HashMap<String, usize> = HashMap::new();

    let pk_indexes: Vec<usize> = pk_columns
        .iter()
        .filter_map(|pk_column| column_names.iter().position(|column| column == pk_column))
        .collect();
    let has_resolved_pk = !pk_columns.is_empty() && pk_indexes.len() == pk_columns.len();

    for row in rows {
        let row_repr = serde_json::to_string(&row).unwrap_or_default();
        *row_counts.entry(row_repr.clone()).or_insert(0) += 1;

        if has_resolved_pk {
            let pk_key = build_pk_key(&row, &pk_indexes);
            rows_by_pk.insert(pk_key, row_repr);
        }
    }

    TableSnapshot {
        pk_columns,
        rows_by_pk,
        row_counts,
    }
}

fn build_pk_key(row: &[serde_json::Value], pk_indexes: &[usize]) -> String {
    pk_indexes
        .iter()
        .map(|index| row.get(*index).cloned().unwrap_or(serde_json::Value::Null))
        .map(|value| serde_json::to_string(&value).unwrap_or_else(|_| "null".to_string()))
        .collect::<Vec<_>>()
        .join("|")
}

fn diff_snapshots(
    previous: &TableSnapshot,
    current: &TableSnapshot,
    table_name: &str,
    subscribed_change_types: &[LiveMonitorChangeType],
) -> Vec<LiveMonitorChangeEvent> {
    let mut events = Vec::new();
    let timestamp = chrono::Utc::now().timestamp_millis();

    let supports_pk_diff = !previous.pk_columns.is_empty()
        && previous.pk_columns == current.pk_columns
        && !previous.rows_by_pk.is_empty()
        && !current.rows_by_pk.is_empty();

    if supports_pk_diff {
        let inserted = current
            .rows_by_pk
            .keys()
            .filter(|key| !previous.rows_by_pk.contains_key(*key))
            .count();
        let deleted = previous
            .rows_by_pk
            .keys()
            .filter(|key| !current.rows_by_pk.contains_key(*key))
            .count();
        let updated = current
            .rows_by_pk
            .iter()
            .filter(|(key, value)| {
                previous
                    .rows_by_pk
                    .get(*key)
                    .is_some_and(|prev| prev != *value)
            })
            .count();

        if inserted > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Insert) {
            events.push(build_change_event(
                timestamp,
                LiveMonitorChangeType::Insert,
                table_name,
                inserted,
                format!(
                    "{inserted} row{} inserted",
                    if inserted == 1 { "" } else { "s" }
                ),
            ));
        }

        if updated > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Update) {
            events.push(build_change_event(
                timestamp,
                LiveMonitorChangeType::Update,
                table_name,
                updated,
                format!(
                    "{updated} row{} updated",
                    if updated == 1 { "" } else { "s" }
                ),
            ));
        }

        if deleted > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Delete) {
            events.push(build_change_event(
                timestamp,
                LiveMonitorChangeType::Delete,
                table_name,
                deleted,
                format!(
                    "{deleted} row{} deleted",
                    if deleted == 1 { "" } else { "s" }
                ),
            ));
        }

        return events;
    }

    let mut inserted = 0usize;
    let mut deleted = 0usize;

    for (row_repr, current_count) in &current.row_counts {
        let previous_count = previous.row_counts.get(row_repr).copied().unwrap_or(0);
        if *current_count > previous_count {
            inserted += *current_count - previous_count;
        }
    }

    for (row_repr, previous_count) in &previous.row_counts {
        let current_count = current.row_counts.get(row_repr).copied().unwrap_or(0);
        if *previous_count > current_count {
            deleted += *previous_count - current_count;
        }
    }

    let updated = inserted.min(deleted);
    inserted -= updated;
    deleted -= updated;

    if inserted > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Insert) {
        events.push(build_change_event(
            timestamp,
            LiveMonitorChangeType::Insert,
            table_name,
            inserted,
            format!(
                "{inserted} row{} added",
                if inserted == 1 { "" } else { "s" }
            ),
        ));
    }

    if updated > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Update) {
        events.push(build_change_event(
            timestamp,
            LiveMonitorChangeType::Update,
            table_name,
            updated,
            format!(
                "{updated} row{} changed",
                if updated == 1 { "" } else { "s" }
            ),
        ));
    }

    if deleted > 0 && subscribed_change_types.contains(&LiveMonitorChangeType::Delete) {
        events.push(build_change_event(
            timestamp,
            LiveMonitorChangeType::Delete,
            table_name,
            deleted,
            format!(
                "{deleted} row{} removed",
                if deleted == 1 { "" } else { "s" }
            ),
        ));
    }

    events
}

fn build_change_event(
    timestamp: i64,
    change_type: LiveMonitorChangeType,
    table_name: &str,
    row_count: usize,
    summary: String,
) -> LiveMonitorChangeEvent {
    LiveMonitorChangeEvent {
        id: Uuid::new_v4().to_string(),
        timestamp,
        change_type,
        table_name: table_name.to_string(),
        summary,
        row_count,
    }
}

fn split_table_reference(table_name: &str) -> Result<(Option<String>, String), Error> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut chars = table_name.chars().peekable();
    let mut in_quotes = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                if in_quotes {
                    if chars.peek() == Some(&'"') {
                        current.push('"');
                        let _ = chars.next();
                    } else {
                        in_quotes = false;
                    }
                } else {
                    in_quotes = true;
                }
            }
            '.' if !in_quotes => {
                let part = current.trim();
                if !part.is_empty() {
                    parts.push(part.to_string());
                }
                current.clear();
            }
            _ => current.push(ch),
        }
    }

    if in_quotes {
        return Err(Error::Any(anyhow::anyhow!(
            "Invalid table reference (unclosed quote): {}",
            table_name
        )));
    }

    let part = current.trim();
    if !part.is_empty() {
        parts.push(part.to_string());
    }

    match parts.as_slice() {
        [table] => Ok((None, table.clone())),
        [schema, table] => Ok((Some(schema.clone()), table.clone())),
        _ => Err(Error::Any(anyhow::anyhow!(
            "Invalid table reference: {}",
            table_name
        ))),
    }
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn quote_table_reference(table_name: &str) -> Result<String, Error> {
    let (schema, table) = split_table_reference(table_name)?;
    if let Some(schema_name) = schema {
        Ok(format!(
            "{}.{}",
            quote_identifier(&schema_name),
            quote_identifier(&table)
        ))
    } else {
        Ok(quote_identifier(&table))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_snapshot(
        columns: Vec<&str>,
        pk_columns: Vec<&str>,
        rows: Vec<Vec<serde_json::Value>>,
    ) -> TableSnapshot {
        build_snapshot(
            columns
                .into_iter()
                .map(std::string::ToString::to_string)
                .collect(),
            pk_columns
                .into_iter()
                .map(std::string::ToString::to_string)
                .collect(),
            rows,
        )
    }

    #[test]
    fn diff_with_primary_key_detects_insert_update_delete() {
        let previous = make_snapshot(
            vec!["id", "name"],
            vec!["id"],
            vec![vec![json!(1), json!("Alice")], vec![json!(2), json!("Bob")]],
        );
        let current = make_snapshot(
            vec!["id", "name"],
            vec!["id"],
            vec![vec![json!(2), json!("Bobby")], vec![json!(3), json!("Cara")]],
        );

        let events = diff_snapshots(
            &previous,
            &current,
            "users",
            &[
                LiveMonitorChangeType::Insert,
                LiveMonitorChangeType::Update,
                LiveMonitorChangeType::Delete,
            ],
        );

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].change_type, LiveMonitorChangeType::Insert);
        assert_eq!(events[0].row_count, 1);
        assert_eq!(events[1].change_type, LiveMonitorChangeType::Update);
        assert_eq!(events[1].row_count, 1);
        assert_eq!(events[2].change_type, LiveMonitorChangeType::Delete);
        assert_eq!(events[2].row_count, 1);
    }

    #[test]
    fn diff_respects_change_type_subscription() {
        let previous = make_snapshot(
            vec!["id", "name"],
            vec!["id"],
            vec![vec![json!(1), json!("Alice")]],
        );
        let current = make_snapshot(
            vec!["id", "name"],
            vec!["id"],
            vec![vec![json!(1), json!("Alice")], vec![json!(2), json!("Bob")]],
        );

        let events = diff_snapshots(&previous, &current, "users", &[LiveMonitorChangeType::Insert]);

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].change_type, LiveMonitorChangeType::Insert);
        assert_eq!(events[0].row_count, 1);
    }

    #[test]
    fn diff_without_primary_key_uses_multiset_fallback() {
        let previous = make_snapshot(
            vec!["name"],
            vec![],
            vec![vec![json!("Alice")], vec![json!("Bob")]],
        );
        let current = make_snapshot(
            vec!["name"],
            vec![],
            vec![vec![json!("Alice")], vec![json!("Cara")]],
        );

        let events = diff_snapshots(
            &previous,
            &current,
            "users",
            &[
                LiveMonitorChangeType::Insert,
                LiveMonitorChangeType::Update,
                LiveMonitorChangeType::Delete,
            ],
        );

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].change_type, LiveMonitorChangeType::Update);
        assert_eq!(events[0].row_count, 1);
    }

    #[test]
    fn split_table_reference_handles_quoted_schema_and_table() {
        let (schema, table) =
            split_table_reference("\"public\".\"user.table\"").expect("reference should parse");
        assert_eq!(schema.as_deref(), Some("public"));
        assert_eq!(table, "user.table");
    }
}

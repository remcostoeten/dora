use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    hash::{Hash, Hasher},
    sync::Arc,
    time::Duration,
};

use base64::Engine;
use dashmap::DashMap;
use futures_util::future::poll_fn;
use mysql_async::{prelude::Queryable, Pool, Row as MySqlRow, Value as MySqlValue};
use rusqlite::types::ValueRef;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, EventTarget, Manager};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_postgres::{AsyncMessage, NoTls};
use tracing::instrument;
use uuid::Uuid;

use crate::{
    credentials,
    database::{
        adapter::watch_adapter_from_client,
        postgres::row_writer::RowWriter as PostgresRowWriter,
        types::{Database, DatabaseClient},
        Certificates,
    },
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

    #[instrument(skip(self, change_types), fields(connection_id = %connection_id, table = %table_name, interval_ms))]
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
    let mut previous_hash: Option<u64> = None;
    let mut previous_snapshot: Option<TableSnapshot> = None;
    let poll_interval = Duration::from_millis(interval_ms.max(1000));
    let mut notification_receiver =
        create_postgres_notification_receiver(&app, connection_id, &table_name).await;

    loop {
        let polled_at = chrono::Utc::now().timestamp_millis();
        let (events, error) = match poll_table_hash(&app, connection_id, &table_name).await {
            Ok(current_hash) => {
                if previous_hash.is_some_and(|previous| previous == current_hash) {
                    (Vec::new(), None)
                } else {
                    match fetch_table_snapshot(&app, connection_id, &table_name).await {
                        Ok(current_snapshot) => {
                            let events = if let Some(previous) = previous_snapshot.as_ref() {
                                diff_snapshots(
                                    previous,
                                    &current_snapshot,
                                    &table_name,
                                    &change_types,
                                )
                            } else {
                                Vec::new()
                            };

                            previous_hash = Some(current_hash);
                            previous_snapshot = Some(current_snapshot);
                            (events, None)
                        }
                        Err(err) => (Vec::new(), Some(err.to_string())),
                    }
                }
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

        if let Some(receiver) = notification_receiver.as_mut() {
            tokio::select! {
                maybe_signal = receiver.recv() => {
                    if maybe_signal.is_none() {
                        notification_receiver = None;
                        tokio::time::sleep(poll_interval).await;
                    }
                }
                _ = tokio::time::sleep(poll_interval) => {}
            }
        } else {
            tokio::time::sleep(poll_interval).await;
        }
    }
}

async fn poll_table_hash(
    app: &AppHandle,
    connection_id: Uuid,
    table_name: &str,
) -> Result<u64, Error> {
    let client = {
        let Some(state) = app.try_state::<AppState>() else {
            return Err(Error::Internal("App state unavailable".to_string()));
        };
        let Some(connection_entry) = state.connections.get(&connection_id) else {
            return Err(Error::ConnectionNotFound(connection_id));
        };
        connection_entry.value().get_client()?
    };

    let (schema, table) = split_table_reference(table_name)?;
    watch_adapter_from_client(&client)
        .poll_table_hash(&table, schema.as_deref())
        .await
}

async fn create_postgres_notification_receiver(
    app: &AppHandle,
    connection_id: Uuid,
    table_name: &str,
) -> Option<UnboundedReceiver<()>> {
    let Some(state) = app.try_state::<AppState>() else {
        return None;
    };

    let connection_entry = state.connections.get(&connection_id)?;
    let (connection_string, tunnel_local_port) = match &connection_entry.value().database {
        Database::Postgres {
            connection_string,
            tunnel,
            ..
        } => (
            connection_string.clone(),
            tunnel
                .as_ref()
                .map(|active_tunnel| active_tunnel.local_port),
        ),
        _ => return None,
    };
    drop(connection_entry);

    let Some(certificates) = app.try_state::<Certificates>() else {
        log::warn!("Live monitor certificates state unavailable; falling back to polling");
        return None;
    };

    let channel_name = postgres_live_monitor_channel(connection_id, table_name);
    let trigger_name = postgres_live_monitor_trigger(table_name);
    let config = match build_postgres_listener_config(
        connection_id,
        &connection_string,
        tunnel_local_port,
    ) {
        Ok(config) => config,
        Err(error) => {
            log::warn!(
                "Failed to build Postgres live monitor listener config for {}: {}",
                table_name,
                error
            );
            return None;
        }
    };

    match connect_and_subscribe_postgres_listener(
        &config,
        &certificates,
        table_name,
        &channel_name,
        &trigger_name,
    )
    .await
    {
        Ok(receiver) => Some(receiver),
        Err(error) => {
            log::warn!(
                "Failed to create Postgres live monitor listener for {}: {}",
                table_name,
                error
            );
            None
        }
    }
}

fn build_postgres_listener_config(
    connection_id: Uuid,
    connection_string: &str,
    tunnel_local_port: Option<u16>,
) -> Result<tokio_postgres::Config, Error> {
    let cleaned_string = if let Ok(mut url) = url::Url::parse(connection_string) {
        let params: Vec<_> = url
            .query_pairs()
            .filter(|(key, _)| key != "channel_binding")
            .map(|(key, value)| format!("{}={}", key, value))
            .collect();
        let query_string = params.join("&");
        url.set_query(if params.is_empty() {
            None
        } else {
            Some(&query_string)
        });
        url.to_string()
    } else {
        connection_string.to_string()
    };

    let mut config: tokio_postgres::Config = cleaned_string.parse().map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to parse Postgres listener connection string '{}': {}",
            cleaned_string,
            error
        ))
    })?;

    if config.get_password().is_none() {
        if let Some(password) = credentials::get_password(&connection_id)? {
            config.password(password);
        }
    }

    if let Some(local_port) = tunnel_local_port {
        config.host("127.0.0.1");
        config.port(local_port);
    }

    Ok(config)
}

async fn connect_and_subscribe_postgres_listener(
    config: &tokio_postgres::Config,
    certificates: &Certificates,
    table_name: &str,
    channel_name: &str,
    trigger_name: &str,
) -> Result<UnboundedReceiver<()>, Error> {
    use tokio_postgres::config::SslMode;

    match config.get_ssl_mode() {
        SslMode::Require | SslMode::Prefer => {
            let certificate_store = certificates.read().await?;
            let rustls_config = rustls::ClientConfig::builder()
                .with_root_certificates(certificate_store)
                .with_no_client_auth();
            let tls = tokio_postgres_rustls::MakeRustlsConnect::new(rustls_config);
            let (client, connection) = config.connect(tls).await.map_err(|error| {
                anyhow::anyhow!("Failed to connect Postgres listener: {}", error)
            })?;
            finalize_postgres_listener(client, connection, table_name, channel_name, trigger_name)
                .await
        }
        _ => {
            let (client, connection) = config.connect(NoTls).await.map_err(|error| {
                anyhow::anyhow!("Failed to connect Postgres listener: {}", error)
            })?;
            finalize_postgres_listener(client, connection, table_name, channel_name, trigger_name)
                .await
        }
    }
}

async fn finalize_postgres_listener<S, T>(
    client: tokio_postgres::Client,
    connection: tokio_postgres::Connection<S, T>,
    table_name: &str,
    channel_name: &str,
    trigger_name: &str,
) -> Result<UnboundedReceiver<()>, Error>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
    T: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    ensure_postgres_notify_trigger(&client, table_name, channel_name, trigger_name).await?;

    let listen_statement = format!("LISTEN {}", quote_identifier(channel_name));
    client.batch_execute(&listen_statement).await?;

    let (sender, receiver) = unbounded_channel();
    spawn_postgres_listener_task(client, connection, sender);
    Ok(receiver)
}

fn spawn_postgres_listener_task<S, T>(
    client: tokio_postgres::Client,
    mut connection: tokio_postgres::Connection<S, T>,
    sender: UnboundedSender<()>,
) where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
    T: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        let _client = client;
        loop {
            let message = poll_fn(|cx| connection.poll_message(cx)).await;
            match message {
                Some(Ok(AsyncMessage::Notification(_notification))) => {
                    let _ = sender.send(());
                }
                Some(Ok(AsyncMessage::Notice(notice))) => {
                    log::debug!("Postgres live monitor notice: {}", notice.message());
                }
                Some(Ok(_)) => {}
                Some(Err(error)) => {
                    log::warn!("Postgres live monitor listener stopped: {}", error);
                    break;
                }
                None => break,
            }
        }
    });
}

async fn ensure_postgres_notify_trigger(
    client: &tokio_postgres::Client,
    table_name: &str,
    channel_name: &str,
    trigger_name: &str,
) -> Result<(), Error> {
    const FUNCTION_SQL: &str = r#"
        CREATE OR REPLACE FUNCTION public.dora_emit_table_change()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
            payload text;
        BEGIN
            payload := json_build_object(
                'schema', TG_TABLE_SCHEMA,
                'table', TG_TABLE_NAME,
                'operation', lower(TG_OP)
            )::text;
            PERFORM pg_notify(TG_ARGV[0], payload);
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$;
    "#;

    client.batch_execute(FUNCTION_SQL).await?;

    let quoted_table = quote_table_reference(table_name)?;
    let escaped_channel = escape_sql_literal(channel_name);
    let escaped_trigger = escape_sql_literal(trigger_name);
    let create_trigger_sql = format!(
        r#"
        DO $dora$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_trigger
                WHERE tgname = '{escaped_trigger}'
            ) THEN
                EXECUTE 'CREATE TRIGGER {trigger_name}
                AFTER INSERT OR UPDATE OR DELETE ON {quoted_table}
                FOR EACH ROW
                EXECUTE FUNCTION public.dora_emit_table_change(''{escaped_channel}'')';
            END IF;
        END
        $dora$;
        "#
    );

    client.batch_execute(&create_trigger_sql).await?;
    Ok(())
}

fn postgres_live_monitor_channel(connection_id: Uuid, table_name: &str) -> String {
    let hash = stable_hash(&(connection_id, table_name.to_string()));
    format!("dora_live_{hash:016x}")
}

fn postgres_live_monitor_trigger(table_name: &str) -> String {
    let hash = stable_hash(&table_name.to_string());
    format!("dora_live_trg_{hash:016x}")
}

fn stable_hash<T: Hash>(value: &T) -> u64 {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

fn escape_sql_literal(value: &str) -> String {
    value.replace('\'', "''")
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
        DatabaseClient::MySQL { pool } => fetch_mysql_snapshot(pool, table_name).await,
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

async fn fetch_mysql_snapshot(
    pool: Arc<Pool>,
    table_name: &str,
) -> Result<TableSnapshot, Error> {
    let (schema, table) = split_table_reference(table_name)?;
    let qualified_table = mysql_qualified_table_name(schema.as_deref(), &table);
    let pk_columns = mysql_primary_key_columns(&pool, schema.as_deref(), &table).await?;
    let query = format!("SELECT * FROM {qualified_table}");

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", err)))?;
    let mut result = conn
        .query_iter(query)
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("MySQL snapshot query failed: {}", err)))?;

    let column_names: Vec<String> = result
        .columns_ref()
        .iter()
        .map(|column| column.name_str().to_string())
        .collect();
    let rows = result
        .collect::<MySqlRow>()
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("MySQL snapshot row failed: {}", err)))?;
    let row_values = rows
        .into_iter()
        .map(|row| row.unwrap().into_iter().map(mysql_value_to_json).collect())
        .collect();

    Ok(build_snapshot(column_names, pk_columns, row_values))
}

async fn mysql_primary_key_columns(
    pool: &Pool,
    schema: Option<&str>,
    table: &str,
) -> Result<Vec<String>, Error> {
    let schema_filter = schema.map(escape_sql_literal);
    let schema_clause = schema_filter
        .as_ref()
        .map(|schema| format!("kcu.TABLE_SCHEMA = '{schema}'"))
        .unwrap_or_else(|| "kcu.TABLE_SCHEMA = DATABASE()".to_string());
    let escaped_table = escape_sql_literal(table);
    let query = format!(
        r#"
        SELECT kcu.COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE kcu
        WHERE {schema_clause}
          AND kcu.TABLE_NAME = '{escaped_table}'
          AND kcu.CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY kcu.ORDINAL_POSITION
        "#
    );

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", err)))?;
    conn.query(query)
        .await
        .map_err(|err| Error::Any(anyhow::anyhow!("MySQL primary key query failed: {}", err)))
}

fn mysql_qualified_table_name(schema: Option<&str>, table: &str) -> String {
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
            libsql::Value::Blob(value) => base64::engine::general_purpose::STANDARD.encode(value),
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
            vec![
                vec![json!(2), json!("Bobby")],
                vec![json!(3), json!("Cara")],
            ],
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

        let events = diff_snapshots(
            &previous,
            &current,
            "users",
            &[LiveMonitorChangeType::Insert],
        );

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

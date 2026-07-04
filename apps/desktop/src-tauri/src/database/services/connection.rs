use anyhow::Context;
use dashmap::DashMap;
use mysql_async::prelude::Queryable;
use std::sync::{Arc, Mutex};
use tracing::instrument;
use uuid::Uuid;

use crate::{
    credentials,
    database::{
        duckdb::{
            file_source::{self, DataFileSourceEntry, DataFileSourceStatus},
            import_files::ImportFilesIntoDuckDbResult,
            save_session::{self, SaveDataFileSessionResult},
        },
        postgres::{connect::connect, connection_string::clean_postgres_connection_string},
        types::{
            ConnectionInfo, Database, DatabaseConnectResult, DatabaseConnection, DatabaseInfo,
        },
        Certificates, ConnectionMonitor,
    },
    error::Error,
    storage::Storage,
};

fn connect_result(connected: bool) -> DatabaseConnectResult {
    DatabaseConnectResult {
        connected,
        file_sources: None,
    }
}

fn duckdb_data_file_connect_result(
    connected: bool,
    file_source_entries: Vec<DataFileSourceEntry>,
) -> DatabaseConnectResult {
    DatabaseConnectResult {
        connected,
        file_sources: Some(file_source_entries),
    }
}

pub struct ConnectionService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub storage: &'a Storage,
}

impl<'a> ConnectionService<'a> {
    #[instrument(skip(self, database_info))]
    pub async fn add_connection(
        &self,
        name: String,
        database_info: DatabaseInfo,
        color: Option<i32>,
    ) -> Result<ConnectionInfo, Error> {
        let id = Uuid::new_v4();

        let original_database_info = database_info.clone();
        let (mut database_info, password) = credentials::extract_sensitive_data(database_info)?;

        if let Some(password) = password {
            if let Err(error) = credentials::store_sensitive_data(&id, &password) {
                log::warn!(
                    "Could not store password in OS credential store for connection {id}; falling back to encrypted connection storage: {error}"
                );
                database_info = original_database_info;
            }
        }

        let connection = DatabaseConnection::new(id, name, database_info);
        let mut info = connection.to_connection_info();

        if let Some(color_hue) = color {
            info.color = Some(color_hue.to_string());
        }

        self.storage.save_connection(&info)?;
        self.connections.insert(id, connection);

        Ok(info)
    }

    #[instrument(skip(self, database_info), fields(conn_id = %conn_id))]
    pub async fn update_connection(
        &self,
        conn_id: Uuid,
        name: String,
        database_info: DatabaseInfo,
        color: Option<i32>,
    ) -> Result<ConnectionInfo, Error> {
        let original_database_info = database_info.clone();
        let (mut database_info, password) = credentials::extract_sensitive_data(database_info)?;
        let password_changed = password.is_some();
        if let Some(password) = password {
            if let Err(error) = credentials::store_sensitive_data(&conn_id, &password) {
                log::warn!(
                    "Could not store password in OS credential store for connection {conn_id}; falling back to encrypted connection storage: {error}"
                );
                database_info = original_database_info;
            }
        }

        if let Some(mut connection_entry) = self.connections.get_mut(&conn_id) {
            let connection = connection_entry.value_mut();

            let config_changed = password_changed
                || match (&connection.database, &database_info) {
                    // Postgres-wire (vanilla + CockroachDB) and MySQL-wire
                    // (vanilla + MariaDB) collapse onto a single runtime variant;
                    // the incoming `DatabaseInfo` may still be either contract
                    // variant, so match both against the same `Database` arm.
                    (
                        Database::Postgres {
                            connection_string: old,
                            ssh_config: old_ssh,
                            ..
                        },
                        DatabaseInfo::Postgres {
                            connection_string: new,
                            ssh_config: new_ssh,
                        }
                        | DatabaseInfo::CockroachDB {
                            connection_string: new,
                            ssh_config: new_ssh,
                        },
                    ) => old != new || old_ssh != new_ssh,
                    (
                        Database::MySQL {
                            connection_string: old,
                            ssh_config: old_ssh,
                            ..
                        },
                        DatabaseInfo::MySQL {
                            connection_string: new,
                            ssh_config: new_ssh,
                        }
                        | DatabaseInfo::MariaDB {
                            connection_string: new,
                            ssh_config: new_ssh,
                        },
                    ) => old != new || old_ssh != new_ssh,
                    (
                        Database::SQLite { db_path: old, .. },
                        DatabaseInfo::SQLite { db_path: new },
                    ) => old != new,
                    (
                        Database::DuckDB {
                            db_path: old,
                            file_sources: old_sources,
                            ..
                        },
                        DatabaseInfo::DuckDB {
                            db_path: new,
                            file_sources: new_sources,
                        },
                    ) => old != new || old_sources != new_sources,
                    (
                        Database::LibSQL {
                            url: old_url,
                            auth_token: old_token,
                            ..
                        },
                        DatabaseInfo::LibSQL {
                            url: new_url,
                            auth_token: new_token,
                        },
                    ) => old_url != new_url || old_token != new_token,
                    _ => true,
                };

            if config_changed {
                match &mut connection.database {
                    Database::Postgres { client, tunnel, .. } => {
                        *client = None;
                        *tunnel = None;
                    }
                    Database::MySQL { pool, tunnel, .. } => {
                        *pool = None;
                        *tunnel = None;
                    }
                    Database::SQLite {
                        connection: conn, ..
                    } => *conn = None,
                    Database::DuckDB {
                        connection: conn, ..
                    } => *conn = None,
                    Database::LibSQL {
                        connection: conn, ..
                    } => *conn = None,
                    Database::D1 {
                        connection: conn, ..
                    } => *conn = None,
                    Database::Posthog {
                        connection: conn, ..
                    } => *conn = None,
                }
                connection.connected = false;
                connection.database = match database_info {
                    DatabaseInfo::Postgres {
                        connection_string,
                        ssh_config,
                    } => Database::Postgres {
                        use_simple_query: crate::database::types::detect_pgbouncer_flag(
                            &connection_string,
                        ),
                        connection_string,
                        ssh_config,
                        client: None,
                        tunnel: None,
                        dialect: crate::database::dialect::PgDialect::Postgres,
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
                        dialect: crate::database::dialect::PgDialect::CockroachDb,
                    },
                    DatabaseInfo::MySQL {
                        connection_string,
                        ssh_config,
                    } => Database::MySQL {
                        connection_string,
                        ssh_config,
                        pool: None,
                        tunnel: None,
                        dialect: crate::database::dialect::MySqlDialect::MySql,
                    },
                    DatabaseInfo::MariaDB {
                        connection_string,
                        ssh_config,
                    } => Database::MySQL {
                        connection_string,
                        ssh_config,
                        pool: None,
                        tunnel: None,
                        dialect: crate::database::dialect::MySqlDialect::MariaDb,
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
            } else {
                match (&mut connection.database, database_info) {
                    (
                        Database::Postgres {
                            connection_string,
                            ssh_config,
                            ..
                        },
                        DatabaseInfo::Postgres {
                            connection_string: new_connection_string,
                            ssh_config: new_ssh_config,
                        }
                        | DatabaseInfo::CockroachDB {
                            connection_string: new_connection_string,
                            ssh_config: new_ssh_config,
                        },
                    ) => {
                        *connection_string = new_connection_string;
                        *ssh_config = new_ssh_config;
                    }
                    (
                        Database::MySQL {
                            connection_string,
                            ssh_config,
                            ..
                        },
                        DatabaseInfo::MySQL {
                            connection_string: new_connection_string,
                            ssh_config: new_ssh_config,
                        }
                        | DatabaseInfo::MariaDB {
                            connection_string: new_connection_string,
                            ssh_config: new_ssh_config,
                        },
                    ) => {
                        *connection_string = new_connection_string;
                        *ssh_config = new_ssh_config;
                    }
                    (
                        Database::SQLite { db_path, .. },
                        DatabaseInfo::SQLite {
                            db_path: new_db_path,
                        },
                    ) => {
                        *db_path = new_db_path;
                    }
                    (
                        Database::DuckDB {
                            db_path,
                            file_sources,
                            ..
                        },
                        DatabaseInfo::DuckDB {
                            db_path: new_db_path,
                            file_sources: new_file_sources,
                        },
                    ) => {
                        *db_path = new_db_path;
                        *file_sources = new_file_sources;
                    }
                    (
                        Database::LibSQL {
                            url, auth_token, ..
                        },
                        DatabaseInfo::LibSQL {
                            url: new_url,
                            auth_token: new_auth_token,
                        },
                    ) => {
                        *url = new_url;
                        *auth_token = new_auth_token;
                    }
                    _ => {}
                }
            }

            connection.updated_at = chrono::Utc::now().timestamp_millis();
            connection.name = name;
        }

        let mut updated_info = self
            .connections
            .get(&conn_id)
            .map(|conn| conn.to_connection_info())
            .with_context(|| format!("Connection not found: {}", conn_id))?;

        if let Some(color_hue) = color {
            updated_info.color = Some(color_hue.to_string());
        }

        self.storage.update_connection(&updated_info)?;

        Ok(updated_info)
    }

    pub async fn update_connection_color(
        &self,
        connection_id: Uuid,
        color: Option<i32>,
    ) -> Result<(), Error> {
        let mut connection_info = self
            .storage
            .get_connection(&connection_id)?
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        connection_info.color = color.map(|c| c.to_string());

        self.storage.update_connection(&connection_info)?;

        if let Some(mut connection_entry) = self.connections.get_mut(&connection_id) {
            let connection = connection_entry.value_mut();
            connection.name = connection_info.name.clone();
        }

        Ok(())
    }

    #[instrument(skip(self, monitor, certificates), fields(connection_id = %connection_id))]
    pub async fn connect_to_database(
        &self,
        monitor: &ConnectionMonitor,
        certificates: &Certificates,
        connection_id: Uuid,
    ) -> Result<DatabaseConnectResult, Error> {
        if !self.connections.contains_key(&connection_id) {
            let stored_connections = self.storage.get_connections()?;
            if let Some(stored_connection) =
                stored_connections.iter().find(|c| c.id == connection_id)
            {
                let connection =
                    DatabaseConnection::from_connection_info(stored_connection.clone());
                self.connections.insert(connection_id, connection);
            }
        }

        // Check if already connected to avoid reconnection loops
        if let Some(connection_entry) = self.connections.get(&connection_id) {
            if connection_entry.connected {
                log::debug!("Already connected to database: {}", connection_id);
                let file_sources = match &connection_entry.database {
                    Database::DuckDB {
                        file_sources,
                        file_source_entries,
                        ..
                    } if !file_sources.is_empty() => Some(file_source_entries.clone()),
                    _ => None,
                };
                return Ok(DatabaseConnectResult {
                    connected: true,
                    file_sources,
                });
            }
        }

        let mut connection_entry = self
            .connections
            .get_mut(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        let connection = connection_entry.value_mut();

        match &mut connection.database {
            Database::Postgres {
                connection_string,
                ssh_config,
                client,
                tunnel,
                dialect,
                ..
            } => {
                // If we have an SSH config, start the tunnel
                if let Some(ssh_conf) = ssh_config {
                    // Parse inner connection string to find the target host/port for the tunnel
                    if let Ok(url) = url::Url::parse(connection_string) {
                        let target_host = url.host_str().unwrap_or("localhost").to_string();
                        let target_port = url.port().unwrap_or(5432);

                        log::info!("Starting SSH tunnel to {}:{}", target_host, target_port);

                        // We need the password/key to be available.
                        // They might be in the ssh_conf struct or in credential store?
                        // SshConfig struct has private_key_path and password options.
                        // But credentials might be sensitive.

                        // Assuming SshConfig in DatabaseInfo has them fully populated?
                        // DatabaseInfo::Postgres { ssh_config: Option<SshConfig> }
                        // But user sensitive data is usually stripped in add_connection.
                        // We might need to retrieve SSH password from keychain if it was stored separately?
                        // For now, let's assume SshConfig holds path to key or password string if persisted.
                        // Ideally we store SSH password similarly to DB password.

                        let tun = crate::database::ssh_tunnel::SshTunnel::start(
                            &ssh_conf.host,
                            ssh_conf.port,
                            &ssh_conf.username,
                            ssh_conf.private_key_path.as_deref(),
                            ssh_conf.password.as_deref(),
                            target_host,
                            target_port,
                        )?;

                        *tunnel = Some(Arc::new(tun));
                    }
                }

                let (cleaned_string, disable_channel_binding, verify_tls) =
                    clean_postgres_connection_string(connection_string);

                let mut config: tokio_postgres::Config =
                    cleaned_string.parse().with_context(|| {
                        format!("Failed to parse connection string: {}", cleaned_string)
                    })?;
                if disable_channel_binding {
                    config.channel_binding(tokio_postgres::config::ChannelBinding::Disable);
                }
                if config.get_password().is_none() {
                    if let Some(pw) = credentials::get_password(&connection_id)? {
                        config.password(pw);
                    }
                }

                if let Some(tun) = tunnel {
                    // If tunneling, we must rewrite the config to point to localhost:local_port
                    let local_port = tun.local_port;
                    log::info!("Tunneling Postgres connection via 127.0.0.1:{}", local_port);

                    // We can't easily modify tokio_postgres::Config host/port after parsing?
                    // We can setting host/port.
                    config.host("127.0.0.1");
                    config.port(local_port);
                    // Disable TLS verification or ensure it matches "localhost"?
                    // Actually if we connect to localhost, certificates might mismatch if they expect the real domain.
                    // But usually via tunnel we disable SSL or accept invalid because we trust the tunnel.
                    // For now, let's assume standard behavior.
                }

                match connect(&config, certificates, verify_tls).await {
                    Ok((pg_client, conn_check)) => {
                        // Detect the real engine (Postgres vs CockroachDB) so
                        // capability gating (e.g. LISTEN/NOTIFY) is based on the
                        // server, not the user's variant choice. The per-engine
                        // `dialect` field is the source of truth; detection
                        // failures are non-fatal and leave the existing (vanilla)
                        // dialect in place.
                        let detected_pg = match pg_client.query_one("SELECT version()", &[]).await {
                            Ok(row) => row
                                .try_get::<usize, String>(0)
                                .ok()
                                .map(|version| crate::database::dialect::detect_pg_dialect(&version)),
                            Err(e) => {
                                log::warn!("Failed to detect Postgres dialect via version(): {}", e);
                                None
                            }
                        };
                        if let Some(detected_pg) = detected_pg {
                            *dialect = detected_pg;
                        }
                        let detected = detected_pg.map(Into::into);

                        *client = Some(Arc::new(pg_client));
                        connection.connected = true;
                        connection.detected_dialect = detected;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        monitor.add_connection(connection_id, conn_check).await;

                        Ok(connect_result(true))
                    }
                    Err(e) => {
                        log::error!("Failed to connect to Postgres: {}", e);
                        *tunnel = None; // Drop tunnel if DB connection fails
                        connection.connected = false;
                        Ok(connect_result(false))
                    }
                }
            }
            Database::MySQL {
                connection_string,
                ssh_config,
                pool,
                tunnel,
                dialect,
            } => {
                // If we have an SSH config, start the tunnel and rewrite the MySQL target to localhost.
                let mut mysql_url = url::Url::parse(connection_string).with_context(|| {
                    format!(
                        "Failed to parse MySQL connection string: {}",
                        connection_string
                    )
                })?;

                if mysql_url.password().is_none() {
                    if let Some(pw) = credentials::get_password(&connection_id)? {
                        let _ = mysql_url.set_password(Some(&pw));
                    }
                }

                if let Some(ssh_conf) = ssh_config {
                    let target_host = mysql_url.host_str().unwrap_or("localhost").to_string();
                    let target_port = mysql_url.port().unwrap_or(3306);

                    log::info!("Starting SSH tunnel to {}:{}", target_host, target_port);
                    let tun = crate::database::ssh_tunnel::SshTunnel::start(
                        &ssh_conf.host,
                        ssh_conf.port,
                        &ssh_conf.username,
                        ssh_conf.private_key_path.as_deref(),
                        ssh_conf.password.as_deref(),
                        target_host,
                        target_port,
                    )?;
                    *tunnel = Some(Arc::new(tun));

                    if let Some(tun) = tunnel {
                        mysql_url.set_host(Some("127.0.0.1")).map_err(|_| {
                            Error::Any(anyhow::anyhow!("Failed to set MySQL host for tunnel"))
                        })?;
                        mysql_url.set_port(Some(tun.local_port)).map_err(|_| {
                            Error::Any(anyhow::anyhow!("Failed to set MySQL port for tunnel"))
                        })?;
                    }
                }

                let mysql_opts = mysql_async::Opts::from_url(&mysql_url.to_string())
                    .map_err(|e| Error::Any(anyhow::anyhow!("Invalid MySQL URL: {}", e)))?;
                let mysql_pool = mysql_async::Pool::new(mysql_opts);

                match mysql_pool.get_conn().await {
                    Ok(mut conn) => {
                        conn.ping().await?;

                        // Detect the real engine (MySQL vs MariaDB). The
                        // per-engine `dialect` field is the source of truth.
                        // Non-fatal: on failure we keep the existing (vanilla)
                        // dialect.
                        let detected_mysql = match conn
                            .query_first::<String, _>("SELECT VERSION()")
                            .await
                        {
                            Ok(Some(version)) => {
                                Some(crate::database::dialect::detect_mysql_dialect(&version))
                            }
                            Ok(None) => None,
                            Err(e) => {
                                log::warn!("Failed to detect MySQL dialect via VERSION(): {}", e);
                                None
                            }
                        };
                        if let Some(detected_mysql) = detected_mysql {
                            *dialect = detected_mysql;
                        }
                        let detected = detected_mysql.map(Into::into);
                        drop(conn);

                        *pool = Some(Arc::new(mysql_pool));
                        connection.connected = true;
                        connection.detected_dialect = detected;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        Ok(connect_result(true))
                    }
                    Err(e) => {
                        log::error!("Failed to connect to MySQL: {}", e);
                        *tunnel = None;
                        *pool = None;
                        connection.connected = false;
                        Ok(connect_result(false))
                    }
                }
            }
            Database::SQLite {
                db_path,
                connection: sqlite_conn,
            } => match rusqlite::Connection::open(&db_path) {
                Ok(conn) => {
                    *sqlite_conn = Some(Arc::new(Mutex::new(conn)));
                    connection.connected = true;

                    if let Err(e) = self.storage.update_last_connected(&connection_id) {
                        log::warn!("Failed to update last connected timestamp: {}", e);
                    }

                    log::info!("Successfully connected to SQLite database: {}", db_path);
                    Ok(connect_result(true))
                }
                Err(e) => {
                    log::error!("Failed to connect to SQLite database {}: {}", db_path, e);
                    connection.connected = false;
                    Ok(connect_result(false))
                }
            },
            Database::DuckDB {
                db_path,
                file_sources,
                file_source_entries,
                connection: duckdb_conn,
            } => {
                // File-source connections live entirely in memory; a real
                // `.duckdb` file connection opens the file directly. Either path
                // (in-process or helper) is selected inside `build_duckdb_backend`.
                let built = crate::database::duckdb_backend::build_duckdb_backend(
                    db_path,
                    file_sources,
                )
                .await;

                match built {
                    Ok((conn_handle, registration)) => {
                        if !file_sources.is_empty() {
                            for entry in &registration {
                                match entry.status {
                                    DataFileSourceStatus::Missing => log::warn!(
                                        "DuckDB data file no longer exists: {}",
                                        entry.path
                                    ),
                                    DataFileSourceStatus::Failed => log::warn!(
                                        "Failed to register DuckDB data file {}: {}",
                                        entry.path,
                                        entry.error.as_deref().unwrap_or("unknown error")
                                    ),
                                    DataFileSourceStatus::Active => {}
                                }
                            }
                            if !file_source::has_active_sources(&registration) {
                                log::error!(
                                    "No DuckDB data files could be opened from {} source(s)",
                                    file_sources.len()
                                );
                                *file_source_entries = registration.clone();
                                connection.connected = false;
                                return Ok(duckdb_data_file_connect_result(false, registration));
                            }
                        }

                        *file_source_entries = registration.clone();
                        *duckdb_conn = Some(conn_handle);
                        connection.connected = true;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        log::info!("Successfully connected to DuckDB database: {}", db_path);
                        if file_sources.is_empty() {
                            Ok(connect_result(true))
                        } else {
                            Ok(duckdb_data_file_connect_result(true, registration))
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to connect to DuckDB database {}: {}", db_path, e);
                        connection.connected = false;
                        if file_sources.is_empty() {
                            Ok(connect_result(false))
                        } else {
                            Ok(duckdb_data_file_connect_result(
                                false,
                                file_source_entries.clone(),
                            ))
                        }
                    }
                }
            }
            Database::LibSQL {
                url,
                auth_token,
                connection: libsql_conn,
            } => {
                let url_str = url.clone();
                let result = if url.starts_with("libsql://") || url.starts_with("https://") {
                    let token = auth_token.clone().unwrap_or_default();
                    libsql::Builder::new_remote(url.clone(), token)
                        .build()
                        .await
                } else {
                    // SAFETY: app Storage opens SQLite first via rusqlite, so libsql's
                    // internal LIBSQL_INIT would fail its sqlite3_config assertion.
                    // skip_safety_assert is safe because the system/bundled SQLite is
                    // already built with SQLITE_CONFIG_SERIALIZED (the default).
                    let builder =
                        unsafe { libsql::Builder::new_local(url).skip_safety_assert(true) };
                    builder.build().await
                };

                match result {
                    Ok(db) => match db.connect() {
                        Ok(conn) => {
                            *libsql_conn = Some(Arc::new(conn));
                            connection.connected = true;

                            if let Err(e) = self.storage.update_last_connected(&connection_id) {
                                log::warn!("Failed to update last connected timestamp: {}", e);
                            }

                            log::info!("Successfully connected to LibSQL database: {}", url_str);
                            Ok(connect_result(true))
                        }
                        Err(e) => {
                            log::error!("Failed to connect to LibSQL database {}: {}", url_str, e);
                            connection.connected = false;
                            Ok(connect_result(false))
                        }
                    },
                    Err(e) => {
                        log::error!("Failed to build LibSQL database {}: {}", url_str, e);
                        connection.connected = false;
                        Ok(connect_result(false))
                    }
                }
            }
            Database::D1 {
                url,
                connection: d1_conn,
            } => {
                // D1 has no wire protocol: "connecting" means loading the
                // encrypted Cloudflare token, building the HTTP handle, and
                // probing it with a trivial query so a bad/expired token fails
                // here rather than on first use.
                let url_str = url.clone();
                let token = match crate::integrations::cloudflare::connect_token(&self.storage) {
                    Ok(token) => token,
                    Err(e) => {
                        log::error!("Cloudflare D1 connect failed for {}: {}", url_str, e);
                        connection.connected = false;
                        return Ok(connect_result(false));
                    }
                };

                let http = match crate::database::d1::D1Http::from_url(url, &token) {
                    Ok(http) => http,
                    Err(e) => {
                        log::error!("Malformed D1 URL {}: {}", url_str, e);
                        connection.connected = false;
                        return Ok(connect_result(false));
                    }
                };

                match http.query("SELECT 1", Vec::new()).await {
                    Ok(_) => {
                        *d1_conn = Some(Arc::new(http));
                        connection.connected = true;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        log::info!("Successfully connected to Cloudflare D1: {}", url_str);
                        Ok(connect_result(true))
                    }
                    Err(e) => {
                        log::error!("Failed to reach Cloudflare D1 {}: {}", url_str, e);
                        connection.connected = false;
                        Ok(connect_result(false))
                    }
                }
            }
            Database::Posthog {
                url,
                connection: posthog_conn,
            } => {
                // PostHog has no wire protocol: "connecting" means loading the
                // encrypted personal API key, building the HTTP handle, and
                // probing it with a trivial HogQL query so a bad/expired key
                // fails here rather than on first use.
                let url_str = url.clone();
                let api_key = match crate::integrations::posthog::connect_token(&self.storage) {
                    Ok(api_key) => api_key,
                    Err(e) => {
                        log::error!("PostHog connect failed for {}: {}", url_str, e);
                        connection.connected = false;
                        return Ok(connect_result(false));
                    }
                };

                let http = match crate::database::posthog::PosthogHttp::from_url(url, &api_key) {
                    Ok(http) => http,
                    Err(e) => {
                        log::error!("Malformed PostHog URL {}: {}", url_str, e);
                        connection.connected = false;
                        return Ok(connect_result(false));
                    }
                };

                match http.query("SELECT 1").await {
                    Ok(_) => {
                        *posthog_conn = Some(Arc::new(http));
                        connection.connected = true;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        log::info!("Successfully connected to PostHog: {}", url_str);
                        Ok(connect_result(true))
                    }
                    Err(e) => {
                        log::error!("Failed to reach PostHog {}: {}", url_str, e);
                        connection.connected = false;
                        Ok(connect_result(false))
                    }
                }
            }
        }
    }

    pub fn get_data_file_source_status(
        &self,
        connection_id: Uuid,
    ) -> Result<Vec<DataFileSourceEntry>, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;

        match &connection_entry.database {
            Database::DuckDB {
                file_sources,
                file_source_entries,
                ..
            } if !file_sources.is_empty() => Ok(file_source_entries.clone()),
            _ => Ok(Vec::new()),
        }
    }

    pub async fn retry_data_file_registration(
        &self,
        monitor: &ConnectionMonitor,
        certificates: &Certificates,
        connection_id: Uuid,
    ) -> Result<DatabaseConnectResult, Error> {
        // Extract the handle + sources without holding the DashMap ref across
        // the await on the (possibly out-of-process) backend.
        let (duckdb_conn, file_sources_snapshot) = {
            let mut connection_entry = self
                .connections
                .get_mut(&connection_id)
                .with_context(|| format!("Connection not found: {}", connection_id))?;

            match &mut connection_entry.value_mut().database {
                Database::DuckDB {
                    file_sources,
                    connection: Some(duckdb_conn),
                    ..
                } if !file_sources.is_empty() => (duckdb_conn.clone(), file_sources.clone()),
                Database::DuckDB { file_sources, .. } if !file_sources.is_empty() => {
                    drop(connection_entry);
                    return self
                        .connect_to_database(monitor, certificates, connection_id)
                        .await;
                }
                _ => {
                    return Err(Error::Any(anyhow::anyhow!(
                        "Connection is not a DuckDB data-file session"
                    )))
                }
            }
        };

        let registration = duckdb_conn.register_sources(file_sources_snapshot).await?;
        let connected = file_source::has_active_sources(&registration);

        {
            let mut connection_entry = self
                .connections
                .get_mut(&connection_id)
                .with_context(|| format!("Connection not found: {}", connection_id))?;
            let connection = connection_entry.value_mut();
            if let Database::DuckDB {
                file_source_entries,
                ..
            } = &mut connection.database
            {
                *file_source_entries = registration.clone();
            }
            connection.connected = connected;
        }

        Ok(duckdb_data_file_connect_result(connected, registration))
    }

    pub async fn save_data_file_session_as_duckdb(
        &self,
        connection_id: Uuid,
        destination_path: String,
        overwrite: bool,
    ) -> Result<SaveDataFileSessionResult, Error> {
        // Extract the handle and a snapshot of the entries, then drop the
        // DashMap ref before awaiting the (possibly out-of-process) backend.
        let (duckdb_conn, file_source_entries) = {
            let connection_entry = self
                .connections
                .get(&connection_id)
                .with_context(|| format!("Connection not found: {}", connection_id))?;

            match &connection_entry.database {
                Database::DuckDB {
                    file_sources,
                    file_source_entries,
                    connection: Some(duckdb_conn),
                    ..
                } if !file_sources.is_empty() => {
                    (duckdb_conn.clone(), file_source_entries.clone())
                }
                Database::DuckDB { file_sources, .. } if !file_sources.is_empty() => {
                    return Err(Error::InvalidInput(
                        "Connect the data-file session before saving".to_string(),
                    ));
                }
                _ => {
                    return Err(Error::InvalidInput(
                        "Connection is not a DuckDB data-file session".to_string(),
                    ));
                }
            }
        };

        if !file_source::has_active_sources(&file_source_entries) {
            return Err(Error::InvalidInput(
                "No active data files to save".to_string(),
            ));
        }

        save_session::validate_destination_path(&destination_path).map_err(Error::InvalidInput)?;

        let result = duckdb_conn
            .materialize_data_file_session(file_source_entries, destination_path, overwrite)
            .await?;

        log::info!(
            "Saved {} table(s) from data-file session {} to {}",
            result.tables.len(),
            connection_id,
            result.path
        );

        Ok(result)
    }

    pub async fn import_files_into_duckdb(
        &self,
        connection_id: Uuid,
        file_paths: Vec<String>,
    ) -> Result<ImportFilesIntoDuckDbResult, Error> {
        if file_paths.is_empty() {
            return Err(Error::InvalidInput(
                "At least one file path is required".to_string(),
            ));
        }

        // Extract the handle, then drop the DashMap ref before awaiting.
        let duckdb_conn = {
            let connection_entry = self
                .connections
                .get(&connection_id)
                .with_context(|| format!("Connection not found: {}", connection_id))?;

            if !connection_entry.connected {
                return Err(Error::InvalidInput(
                    "Connect the DuckDB database before importing files".to_string(),
                ));
            }

            match &connection_entry.database {
                Database::DuckDB {
                    file_sources,
                    connection: Some(duckdb_conn),
                    ..
                } if file_sources.is_empty() => duckdb_conn.clone(),
                Database::DuckDB { file_sources, .. } if !file_sources.is_empty() => {
                    return Err(Error::InvalidInput(
                        "Import files is only available for native DuckDB database connections"
                            .to_string(),
                    ));
                }
                Database::DuckDB { .. } => {
                    return Err(Error::InvalidInput(
                        "Connect the DuckDB database before importing files".to_string(),
                    ));
                }
                _ => {
                    return Err(Error::InvalidInput(
                        "Import files is only available for DuckDB database connections".to_string(),
                    ));
                }
            }
        };

        let result = duckdb_conn.import_files(file_paths).await?;

        log::info!(
            "Imported {} table(s) into DuckDB connection {}",
            result.tables.len(),
            connection_id
        );

        Ok(result)
    }

    #[instrument(skip(self), fields(connection_id = %connection_id))]
    pub async fn disconnect_from_database(&self, connection_id: Uuid) -> Result<(), Error> {
        let mut connection_entry = self
            .connections
            .get_mut(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;
        let connection = connection_entry.value_mut();

        match &mut connection.database {
            Database::Postgres { client, tunnel, .. } => {
                *client = None;
                *tunnel = None;
            }
            Database::MySQL { pool, tunnel, .. } => {
                *pool = None;
                *tunnel = None;
            }
            Database::SQLite {
                connection: sqlite_conn,
                ..
            } => *sqlite_conn = None,
            Database::DuckDB {
                connection: duckdb_conn,
                ..
            } => *duckdb_conn = None,
            Database::LibSQL {
                connection: libsql_conn,
                ..
            } => *libsql_conn = None,
            Database::D1 {
                connection: d1_conn,
                ..
            } => *d1_conn = None,
            Database::Posthog {
                connection: posthog_conn,
                ..
            } => *posthog_conn = None,
        }
        connection.connected = false;
        Ok(())
    }

    pub async fn get_connections(&self) -> Result<Vec<ConnectionInfo>, Error> {
        let mut stored_connections = self.storage.get_connections()?;

        for connection in &mut stored_connections {
            if let Some(runtime_connection) = self.connections.get(&connection.id) {
                connection.connected = runtime_connection.connected;
            } else {
                connection.connected = false;
            }
        }

        Ok(stored_connections)
    }

    pub async fn remove_connection(&self, connection_id: Uuid) -> Result<(), Error> {
        if let Err(e) = credentials::delete_password(&connection_id) {
            log::debug!(
                "Could not delete password from keyring (may not exist): {}",
                e
            );
        }

        self.storage.remove_connection(&connection_id)?;
        self.connections.remove(&connection_id);

        Ok(())
    }

    pub async fn initialize_connections(&self) -> Result<(), Error> {
        let stored_connections = self.storage.get_connections()?;

        for stored_connection in stored_connections {
            let connection = DatabaseConnection::from_connection_info(stored_connection);
            self.connections.insert(connection.id, connection);
        }

        log::info!(
            "Initialized {} connections from storage",
            self.connections.len()
        );
        Ok(())
    }

    pub async fn get_recent_connections(
        &self,
        limit: Option<u32>,
    ) -> Result<Vec<ConnectionInfo>, Error> {
        let connections = self.storage.get_connections()?;

        let mut sorted: Vec<_> = connections
            .into_iter()
            .filter(|c| c.last_connected_at.is_some())
            .collect();

        sorted.sort_by(|a, b| b.last_connected_at.cmp(&a.last_connected_at));

        if let Some(limit) = limit {
            sorted.truncate(limit as usize);
        }

        Ok(sorted)
    }

    pub async fn set_connection_pin(
        &self,
        connection_id: Uuid,
        pin: Option<String>,
    ) -> Result<(), Error> {
        let mut connection_entry = self
            .connections
            .get_mut(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;
        let connection = connection_entry.value_mut();

        if let Some(p) = pin {
            // Hash the PIN
            let hashed = bcrypt::hash(p, bcrypt::DEFAULT_COST)
                .map_err(|e| Error::Any(anyhow::anyhow!("Failed to hash PIN: {}", e)))?;
            connection.pin_hash = Some(hashed);
        } else {
            connection.pin_hash = None;
        }

        // Persist update
        connection.updated_at = chrono::Utc::now().timestamp_millis();
        let info = connection.to_connection_info();
        self.storage.update_connection(&info)?;

        Ok(())
    }

    pub async fn verify_pin_and_get_credentials(
        &self,
        connection_id: Uuid,
        pin: String,
    ) -> Result<Option<String>, Error> {
        let connection_entry = self
            .connections
            .get(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;
        let connection = connection_entry.value();

        if let Some(hash) = &connection.pin_hash {
            let valid = bcrypt::verify(&pin, hash)
                .map_err(|e| Error::Any(anyhow::anyhow!("Failed to verify PIN: {}", e)))?;

            if !valid {
                return Err(Error::Any(anyhow::anyhow!("Invalid PIN")));
            }

            // PIN matches, retrieve password
            credentials::get_password(&connection_id).map_err(Into::into)
        } else {
            // No PIN set - should we allow or error?
            // "Show only if pin is given" implies pin MUST be set to require it.
            // But if no PIN is set, user can just access credentials normally?
            // Current "reveal" UI should likely check `has_pin` first.
            // If connection has no pin, maybe return password directly?
            // But safety-wise, "verify_pin" suggests checking "Security".
            // If no PIN set, we just return the password.
            credentials::get_password(&connection_id).map_err(Into::into)
        }
    }
}

// Static method that doesn't need state
impl ConnectionService<'_> {
    #[instrument(skip(database_info, certificates))]
    pub async fn test_connection(
        database_info: DatabaseInfo,
        connection_id: Option<Uuid>,
        certificates: &Certificates,
    ) -> Result<bool, Error> {
        match database_info {
            DatabaseInfo::CockroachDB {
                connection_string,
                ssh_config,
            }
            | DatabaseInfo::Postgres {
                connection_string,
                ssh_config,
            } => {
                let temp_tunnel = if let Some(conf) = ssh_config {
                    if let Ok(url) = url::Url::parse(&connection_string) {
                        let target_host = url.host_str().unwrap_or("localhost").to_string();
                        let target_port = url.port().unwrap_or(5432);

                        log::info!("Testing SSH tunnel to {}:{}", target_host, target_port);

                        match crate::database::ssh_tunnel::SshTunnel::start(
                            &conf.host,
                            conf.port,
                            &conf.username,
                            conf.private_key_path.as_deref(),
                            conf.password.as_deref(),
                            target_host,
                            target_port,
                        ) {
                            Ok(tun) => Some(Arc::new(tun)),
                            Err(e) => {
                                log::error!("SSH tunnel test failed: {}", e);
                                return Err(Error::Any(anyhow::anyhow!(
                                    "SSH tunnel failed: {}",
                                    e
                                )));
                            }
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                let (cleaned_string, disable_channel_binding, verify_tls) =
                    clean_postgres_connection_string(&connection_string);

                let mut config: tokio_postgres::Config =
                    cleaned_string.parse().with_context(|| {
                        format!("Failed to parse connection string: {}", cleaned_string)
                    })?;
                if disable_channel_binding {
                    config.channel_binding(tokio_postgres::config::ChannelBinding::Disable);
                }

                if config.get_password().is_none() {
                    if let Some(ref id) = connection_id {
                        if let Some(pw) = credentials::get_password(id)? {
                            config.password(pw);
                        }
                    }
                }

                if let Some(ref tun) = temp_tunnel {
                    let local_port = tun.local_port;
                    log::info!("Tunneling test connection via 127.0.0.1:{}", local_port);
                    config.host("127.0.0.1");
                    config.port(local_port);
                }

                log::info!("Testing Postgres connection: {config:?}");
                match connect(&config, certificates, verify_tls).await {
                    Ok(_) => {
                        drop(temp_tunnel);
                        Ok(true)
                    }
                    Err(e) => {
                        log::error!("Postgres connection test failed: {}", e);
                        drop(temp_tunnel);
                        Err(Error::from(e))
                    }
                }
            }
            DatabaseInfo::SQLite { db_path } => match rusqlite::Connection::open(db_path) {
                Ok(_) => Ok(true),
                Err(e) => {
                    log::error!("SQLite connection test failed: {}", e);
                    Err(Error::from(e))
                }
            },
            DatabaseInfo::DuckDB {
                db_path,
                file_sources,
            } => {
                let (_conn, entries) =
                    crate::database::duckdb_backend::build_duckdb_backend(&db_path, &file_sources)
                        .await?;
                if file_sources.is_empty() {
                    Ok(true)
                } else {
                    if !file_source::has_active_sources(&entries) {
                        let detail = entries
                            .iter()
                            .find(|entry| entry.status != DataFileSourceStatus::Active)
                            .map(|entry| match entry.status {
                                DataFileSourceStatus::Missing => {
                                    format!("file not found: {}", entry.path)
                                }
                                DataFileSourceStatus::Failed => format!(
                                    "{}: {}",
                                    entry.path,
                                    entry.error.as_deref().unwrap_or("registration failed")
                                ),
                                DataFileSourceStatus::Active => String::new(),
                            })
                            .unwrap_or_else(|| "no data files provided".to_string());
                        Err(Error::Any(anyhow::anyhow!(
                            "Could not open data file source — {}",
                            detail
                        )))
                    } else {
                        Ok(true)
                    }
                }
            }
            DatabaseInfo::LibSQL { url, auth_token } => {
                log::info!("Testing LibSQL connection: {}", url);

                let result = if url.starts_with("libsql://") || url.starts_with("https://") {
                    let token = auth_token.unwrap_or_default();
                    libsql::Builder::new_remote(url.clone(), token)
                        .build()
                        .await
                } else {
                    // SAFETY: same reason as connect_to_database — Storage has
                    // already called sqlite3_initialize via rusqlite.
                    let builder =
                        unsafe { libsql::Builder::new_local(&url).skip_safety_assert(true) };
                    builder.build().await
                };

                match result {
                    Ok(db) => match db.connect() {
                        Ok(_) => Ok(true),
                        Err(e) => {
                            log::error!("LibSQL connection test failed: {}", e);
                            Err(Error::Any(anyhow::anyhow!(
                                "LibSQL connection failed: {}",
                                e
                            )))
                        }
                    },
                    Err(e) => {
                        log::error!("LibSQL build failed: {}", e);
                        Err(Error::Any(anyhow::anyhow!("LibSQL build failed: {}", e)))
                    }
                }
            }
            DatabaseInfo::MariaDB {
                connection_string,
                ssh_config,
            }
            | DatabaseInfo::MySQL {
                connection_string,
                ssh_config,
            } => {
                let mut mysql_url = url::Url::parse(&connection_string).with_context(|| {
                    format!(
                        "Failed to parse MySQL connection string: {}",
                        connection_string
                    )
                })?;

                let temp_tunnel = if let Some(conf) = ssh_config {
                    if let Some(target_host) = mysql_url.host_str() {
                        let target_port = mysql_url.port().unwrap_or(3306);
                        log::info!("Testing SSH tunnel to {}:{}", target_host, target_port);

                        match crate::database::ssh_tunnel::SshTunnel::start(
                            &conf.host,
                            conf.port,
                            &conf.username,
                            conf.private_key_path.as_deref(),
                            conf.password.as_deref(),
                            target_host.to_string(),
                            target_port,
                        ) {
                            Ok(tun) => Some(Arc::new(tun)),
                            Err(e) => {
                                log::error!("SSH tunnel test failed: {}", e);
                                return Err(Error::Any(anyhow::anyhow!(
                                    "SSH tunnel failed: {}",
                                    e
                                )));
                            }
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                if let Some(ref tun) = temp_tunnel {
                    mysql_url.set_host(Some("127.0.0.1")).map_err(|_| {
                        Error::Any(anyhow::anyhow!("Failed to set MySQL host for tunnel"))
                    })?;
                    mysql_url.set_port(Some(tun.local_port)).map_err(|_| {
                        Error::Any(anyhow::anyhow!("Failed to set MySQL port for tunnel"))
                    })?;
                }

                let mysql_opts = mysql_async::Opts::from_url(&mysql_url.to_string())
                    .map_err(|e| Error::Any(anyhow::anyhow!("Invalid MySQL URL: {}", e)))?;
                let pool = mysql_async::Pool::new(mysql_opts);
                match pool.get_conn().await {
                    Ok(mut conn) => {
                        conn.ping().await?;
                        Ok(true)
                    }
                    Err(e) => Err(Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e))),
                }
            }
            DatabaseInfo::D1 { url } => {
                log::info!("Testing Cloudflare D1 connection: {}", url);
                // The API token lives in the encrypted Cloudflare setting, not on
                // the connection, and was already validated when it was saved
                // (and again the first time the database list was fetched). This
                // static test path has no storage handle, so it validates the
                // `d1://account/database` URL shape; the live query probe runs in
                // `connect_to_database`.
                crate::database::d1::parse_d1_url(&url)?;
                Ok(true)
            }
            DatabaseInfo::Posthog { url } => {
                log::info!("Testing PostHog connection: {}", url);
                // The API key lives in the encrypted PostHog setting, not on the
                // connection, and was already validated when it was saved. This
                // static test path has no storage handle, so it validates the
                // `posthog://region/project` URL shape; the live query probe runs
                // in `connect_to_database`.
                crate::database::posthog::parse_posthog_url(&url)?;
                Ok(true)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::database::{
        postgres::connection_string::clean_postgres_connection_string, types::detect_pgbouncer_flag,
    };

    #[test]
    fn pooler_host_enables_simple_query_mode_without_provider_specific_flag() {
        let url =
            "postgresql://postgres.project:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

        assert!(detect_pgbouncer_flag(url));

        let (cleaned, disable_channel_binding, verify_tls) = clean_postgres_connection_string(url);
        assert!(disable_channel_binding);
        assert!(!verify_tls);
        assert!(cleaned.contains("sslmode=require"));
    }

    #[test]
    fn explicit_pooler_hints_are_removed_before_tokio_postgres_parsing() {
        let url = "postgresql://user:pw@example.com/db?sslmode=require&prepared_statements=false&statement_cache_size=0";

        assert!(detect_pgbouncer_flag(url));

        let (cleaned, disable_channel_binding, verify_tls) = clean_postgres_connection_string(url);
        assert!(!disable_channel_binding);
        assert!(!verify_tls);
        assert_eq!(
            cleaned,
            "postgresql://user:pw@example.com/db?sslmode=require"
        );
    }

    #[test]
    fn generic_pooler_ports_enable_pooler_mode() {
        assert!(detect_pgbouncer_flag(
            "postgresql://user:pw@example.com:6432/db"
        ));
        assert!(detect_pgbouncer_flag(
            "postgresql://user:pw@example.com:6543/db"
        ));
    }

    #[test]
    fn verify_full_sslmode_uses_tls_verification_without_passing_unknown_mode_through() {
        let url = "postgresql://user:pw@example.com/db?sslmode=verify-full";

        let (cleaned, disable_channel_binding, verify_tls) = clean_postgres_connection_string(url);
        assert!(!disable_channel_binding);
        assert!(verify_tls);
        assert_eq!(
            cleaned,
            "postgresql://user:pw@example.com/db?sslmode=require"
        );
    }
}

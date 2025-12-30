use std::sync::{Arc, Mutex};
use anyhow::Context;
use dashmap::DashMap;
use uuid::Uuid;

use crate::{
    credentials,
    database::{
        postgres::{self, connect::connect},
        types::{
            ConnectionInfo, Database, DatabaseConnection, DatabaseInfo,
        },
        Certificates, ConnectionMonitor,
    },
    error::Error,
    storage::Storage,
};

pub struct ConnectionService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub storage: &'a Storage,
}

impl<'a> ConnectionService<'a> {
    pub async fn add_connection(
        &self,
        name: String,
        database_info: DatabaseInfo,
        color: Option<i32>,
    ) -> Result<ConnectionInfo, Error> {
        let id = Uuid::new_v4();

        let (database_info, password) = credentials::extract_sensitive_data(database_info)?;

        if let Some(password) = password {
            credentials::store_sensitive_data(&id, &password)?;
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

    pub async fn update_connection(
        &self,
        conn_id: Uuid,
        name: String,
        database_info: DatabaseInfo,
        color: Option<i32>,
    ) -> Result<ConnectionInfo, Error> {
        let (database_info, password) = credentials::extract_sensitive_data(database_info)?;
        if let Some(password) = password {
            credentials::store_sensitive_data(&conn_id, &password)?;
        }

        if let Some(mut connection_entry) = self.connections.get_mut(&conn_id) {
            let connection = connection_entry.value_mut();

            let config_changed = match (&connection.database, &database_info) {
                (
                    Database::Postgres {
                        connection_string: old,
                        ..
                    },
                    DatabaseInfo::Postgres {
                        connection_string: new,
                    },
                ) => old != new,
                (Database::SQLite { db_path: old, .. }, DatabaseInfo::SQLite { db_path: new }) => {
                    old != new
                }
                _ => true,
            };

            if config_changed {
                match &mut connection.database {
                    Database::Postgres { client, .. } => *client = None,
                    Database::SQLite {
                        connection: conn, ..
                    } => *conn = None,
                    Database::LibSQL {
                        connection: conn, ..
                    } => *conn = None,
                }
                connection.connected = false;
            }

            connection.name = name;
            connection.database = match database_info {
                DatabaseInfo::Postgres { connection_string } => Database::Postgres {
                    connection_string,
                    client: None,
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

    pub async fn connect_to_database(
        &self,
        monitor: &ConnectionMonitor,
        certificates: &Certificates,
        connection_id: Uuid,
    ) -> Result<bool, Error> {
        if !self.connections.contains_key(&connection_id) {
            let stored_connections = self.storage.get_connections()?;
            if let Some(stored_connection) = stored_connections.iter().find(|c| c.id == connection_id) {
                let connection = DatabaseConnection::new(
                    stored_connection.id,
                    stored_connection.name.clone(),
                    stored_connection.database_type.clone(),
                );
                self.connections.insert(connection_id, connection);
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
                client,
            } => {
                let cleaned_string = if let Ok(mut url) = url::Url::parse(&*connection_string) {
                    let params: Vec<_> = url
                        .query_pairs()
                        .filter(|(k, _)| k != "channel_binding")
                        .map(|(k, v)| format!("{}={}", k, v))
                        .collect();

                    let query_string = params.join("&");
                    url.set_query(if params.is_empty() {
                        None
                    } else {
                        Some(&query_string)
                    });
                    url.to_string()
                } else {
                    connection_string.clone()
                };

                let mut config: tokio_postgres::Config = cleaned_string.parse().with_context(|| {
                    format!("Failed to parse connection string: {}", cleaned_string)
                })?;
                if config.get_password().is_none() {
                    credentials::get_password(&connection_id)?.map(|pw| config.password(pw));
                }

                match connect(&config, certificates).await {
                    Ok((pg_client, conn_check)) => {
                        *client = Some(Arc::new(pg_client));
                        connection.connected = true;

                        if let Err(e) = self.storage.update_last_connected(&connection_id) {
                            log::warn!("Failed to update last connected timestamp: {}", e);
                        }

                        monitor.add_connection(connection_id, conn_check).await;

                        Ok(true)
                    }
                    Err(e) => {
                        log::error!("Failed to connect to Postgres: {}", e);
                        connection.connected = false;
                        Ok(false)
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
                    Ok(true)
                }
                Err(e) => {
                    log::error!("Failed to connect to SQLite database {}: {}", db_path, e);
                    connection.connected = false;
                    Ok(false)
                }
            },
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
                    libsql::Builder::new_local(url).build().await
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
                            Ok(true)
                        }
                        Err(e) => {
                            log::error!("Failed to connect to LibSQL database {}: {}", url_str, e);
                            connection.connected = false;
                            Ok(false)
                        }
                    },
                    Err(e) => {
                        log::error!("Failed to build LibSQL database {}: {}", url_str, e);
                        connection.connected = false;
                        Ok(false)
                    }
                }
            }
        }
    }

    pub async fn disconnect_from_database(
        &self,
        connection_id: Uuid,
    ) -> Result<(), Error> {
        let mut connection_entry = self
            .connections
            .get_mut(&connection_id)
            .with_context(|| format!("Connection not found: {}", connection_id))?;
        let connection = connection_entry.value_mut();

        match &mut connection.database {
            Database::Postgres { client, .. } => *client = None,
            Database::SQLite {
                connection: sqlite_conn,
                ..
            } => *sqlite_conn = None,
            Database::LibSQL {
                connection: libsql_conn,
                ..
            } => *libsql_conn = None,
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
            let connection = DatabaseConnection::new(
                stored_connection.id,
                stored_connection.name,
                stored_connection.database_type,
            );
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
        
        let mut sorted: Vec<_> = connections.into_iter()
            .filter(|c| c.last_connected_at.is_some())
            .collect();
        
        sorted.sort_by(|a, b| {
            b.last_connected_at.cmp(&a.last_connected_at)
        });

        if let Some(limit) = limit {
            sorted.truncate(limit as usize);
        }

        Ok(sorted)
    }
}

// Static method that doesn't need state
impl ConnectionService<'_> {
    pub async fn test_connection(
        database_info: DatabaseInfo,
        certificates: &Certificates,
    ) -> Result<bool, Error> {
        match database_info {
            DatabaseInfo::Postgres { connection_string } => {
                let cleaned_string = if let Ok(mut url) = url::Url::parse(&connection_string) {
                    let params: Vec<_> = url
                        .query_pairs()
                        .filter(|(k, _)| k != "channel_binding")
                        .map(|(k, v)| format!("{}={}", k, v))
                        .collect();

                    let query_string = params.join("&");
                    url.set_query(if params.is_empty() {
                        None
                    } else {
                        Some(&query_string)
                    });
                    url.to_string()
                } else {
                    connection_string.clone()
                };

                let config: tokio_postgres::Config = cleaned_string.parse().with_context(|| {
                    format!("Failed to parse connection string: {}", cleaned_string)
                })?;
                log::info!("Testing Postgres connection: {config:?}");
                match connect(&config, certificates).await {
                    Ok(_) => Ok(true),
                    Err(e) => {
                        log::error!("Postgres connection test failed: {}", e);
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
            DatabaseInfo::LibSQL { url, auth_token } => {
                log::info!("Testing LibSQL connection: {}", url);

                let result = if url.starts_with("libsql://") || url.starts_with("https://") {
                    let token = auth_token.unwrap_or_default();
                    libsql::Builder::new_remote(url.clone(), token)
                        .build()
                        .await
                } else {
                    libsql::Builder::new_local(&url).build().await
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
        }
    }
}

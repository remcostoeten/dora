use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use dashmap::DashMap;
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{
    catalog::{AgentProfile, ReadEnforcement},
    encode::redact,
    errors::{McpErrorCode, McpFailure},
    session::{apply_read_only, MYSQL_READ_ONLY_SETUP},
};
use crate::{
    config::AppConfig,
    database::{
        connection_repository::{ConnectionMapRepository, ConnectionRepository},
        services::{
            connection::{ConnectionService, MYSQL_SESSION_SETUP},
            metadata::MetadataService,
        },
        stmt_manager::StatementManager,
        types::{ConnectionInfo, DatabaseConnection, DatabaseSchema},
        Certificates, ConnectionMonitor,
    },
    kv::KvConnection,
    storage::{hash_agent_statements, KvConnectionInfo, Storage},
};

const SCHEMA_CACHE_TTL: Duration = Duration::from_secs(60);
const WRITE_IDLE_TTL: Duration = Duration::from_secs(60);

pub struct McpState {
    pub connections: DashMap<Uuid, DatabaseConnection>,
    pub write_connections: DashMap<Uuid, DatabaseConnection>,
    pub kv_connections: DashMap<Uuid, KvConnection>,
    pub schemas: DashMap<Uuid, Arc<DatabaseSchema>>,
    pub schema_locks: DashMap<Uuid, Arc<Mutex<()>>>,
    pub storage: Storage,
    pub stmt_manager: StatementManager,
    certificates: Certificates,
    monitor: ConnectionMonitor,
    write_monitor: ConnectionMonitor,
    connection_locks: DashMap<Uuid, Arc<Mutex<()>>>,
    read_sessions: DashMap<Uuid, ReadEnforcement>,
    schema_loaded_at: DashMap<Uuid, Instant>,
    write_last_used: DashMap<Uuid, Instant>,
    read_fingerprints: DashMap<Uuid, String>,
    write_fingerprints: DashMap<Uuid, String>,
    kv_fingerprints: DashMap<Uuid, String>,
}

impl McpState {
    pub fn open() -> crate::Result<Self> {
        let config = AppConfig::load()?;
        let storage = Storage::open_existing(config.resolve_active_path()?)?;
        Ok(Self {
            connections: DashMap::new(),
            write_connections: DashMap::new(),
            kv_connections: DashMap::new(),
            schemas: DashMap::new(),
            schema_locks: DashMap::new(),
            storage,
            stmt_manager: StatementManager::new(),
            certificates: Certificates::new(),
            monitor: ConnectionMonitor::headless(),
            write_monitor: ConnectionMonitor::headless(),
            connection_locks: DashMap::new(),
            read_sessions: DashMap::new(),
            schema_loaded_at: DashMap::new(),
            write_last_used: DashMap::new(),
            read_fingerprints: DashMap::new(),
            write_fingerprints: DashMap::new(),
            kv_fingerprints: DashMap::new(),
        })
    }

    pub fn connection_lock(&self, connection_id: Uuid) -> Arc<Mutex<()>> {
        self.connection_locks
            .entry(connection_id)
            .or_default()
            .clone()
    }

    async fn reap_dropped(&self) {
        for connection_id in self.monitor.take_dropped().await {
            self.read_sessions.remove(&connection_id);
            self.schema_loaded_at.remove(&connection_id);
            self.schemas.remove(&connection_id);
            self.connections.remove(&connection_id);
        }
        for connection_id in self.write_monitor.take_dropped().await {
            self.write_last_used.remove(&connection_id);
            self.write_connections.remove(&connection_id);
        }
    }

    /// @name ensure_read
    /// @description Opens the read client when needed and confirms its read-only
    /// session. The caller holds the connection lock.
    ///
    /// @example
    /// let enforcement = state.ensure_read(id, &info, &profile).await?;
    pub async fn ensure_read(
        &self,
        connection_id: Uuid,
        info: &ConnectionInfo,
        profile: &AgentProfile,
    ) -> Result<ReadEnforcement, McpFailure> {
        self.reap_dropped().await;
        let fingerprint = fingerprint_of(&info.database_type)?;
        if self
            .read_fingerprints
            .get(&connection_id)
            .is_some_and(|current| *current != fingerprint)
        {
            self.close_read(connection_id).await;
        }
        if let Some(enforcement) = self.read_sessions.get(&connection_id) {
            return Ok(*enforcement);
        }

        let service = ConnectionService {
            connections: &self.connections,
            storage: &self.storage,
        };
        let setup = vec![MYSQL_READ_ONLY_SETUP.to_string()];
        let outcome = MYSQL_SESSION_SETUP
            .scope(
                setup,
                service.open_connection(&self.monitor, &self.certificates, connection_id),
            )
            .await
            .map_err(|error| connection_failure(&error.to_string(), info))?;
        if !outcome.result.connected {
            let message = outcome
                .result
                .error
                .unwrap_or_else(|| "The connection could not be opened.".to_string());
            return Err(connection_failure(&message, info));
        }

        let repository = ConnectionMapRepository {
            connections: &self.connections,
        };
        let client = repository
            .get_client(connection_id)
            .map_err(|error| connection_failure(&error.to_string(), info))?;
        match apply_read_only(&client, profile.read_enforcement).await {
            Ok(enforcement) => {
                self.read_sessions.insert(connection_id, enforcement);
                self.read_fingerprints.insert(connection_id, fingerprint);
                Ok(enforcement)
            }
            Err(message) => {
                if let Err(error) = service
                    .disconnect_from_database(&self.monitor, connection_id)
                    .await
                {
                    log::warn!("Failed to close read session: {error}");
                }
                self.connections.remove(&connection_id);
                Err(connection_failure(&message, info))
            }
        }
    }

    /// @name ensure_write
    /// @description Opens the separate write client for a connection. It never
    /// shares a session with `run_query`.
    ///
    /// @example
    /// state.ensure_write(id, &info).await?;
    pub async fn ensure_write(
        &self,
        connection_id: Uuid,
        info: &ConnectionInfo,
    ) -> Result<(), McpFailure> {
        self.reap_dropped().await;
        let fingerprint = fingerprint_of(&info.database_type)?;
        if self
            .write_fingerprints
            .get(&connection_id)
            .is_some_and(|current| *current != fingerprint)
        {
            self.close_write(connection_id).await;
        }
        let service = ConnectionService {
            connections: &self.write_connections,
            storage: &self.storage,
        };
        let outcome = service
            .open_connection(&self.write_monitor, &self.certificates, connection_id)
            .await
            .map_err(|error| connection_failure(&error.to_string(), info))?;
        if !outcome.result.connected {
            let message = outcome
                .result
                .error
                .unwrap_or_else(|| "The connection could not be opened.".to_string());
            return Err(connection_failure(&message, info));
        }
        self.write_last_used.insert(connection_id, Instant::now());
        self.write_fingerprints.insert(connection_id, fingerprint);
        Ok(())
    }

    async fn close_read(&self, connection_id: Uuid) {
        let service = ConnectionService {
            connections: &self.connections,
            storage: &self.storage,
        };
        if let Err(error) = service
            .disconnect_from_database(&self.monitor, connection_id)
            .await
        {
            log::debug!("Read session was already closed: {error}");
        }
        self.connections.remove(&connection_id);
        self.read_sessions.remove(&connection_id);
        self.read_fingerprints.remove(&connection_id);
        self.schema_loaded_at.remove(&connection_id);
        self.schemas.remove(&connection_id);
    }

    pub fn write_repository(&self) -> ConnectionMapRepository<'_> {
        ConnectionMapRepository {
            connections: &self.write_connections,
        }
    }

    pub fn read_repository(&self) -> ConnectionMapRepository<'_> {
        ConnectionMapRepository {
            connections: &self.connections,
        }
    }

    pub fn mark_write_used(&self, connection_id: Uuid) {
        self.write_last_used.insert(connection_id, Instant::now());
    }

    pub async fn close_write(&self, connection_id: Uuid) {
        let service = ConnectionService {
            connections: &self.write_connections,
            storage: &self.storage,
        };
        if let Err(error) = service
            .disconnect_from_database(&self.write_monitor, connection_id)
            .await
        {
            log::debug!("Write session was already closed: {error}");
        }
        self.write_connections.remove(&connection_id);
        self.write_last_used.remove(&connection_id);
        self.write_fingerprints.remove(&connection_id);
    }

    pub async fn close_idle_writes(&self) {
        let idle: Vec<Uuid> = self
            .write_last_used
            .iter()
            .filter(|entry| entry.value().elapsed() >= WRITE_IDLE_TTL)
            .map(|entry| *entry.key())
            .collect();
        for connection_id in idle {
            let lock = self.connection_lock(connection_id);
            let _guard = lock.lock().await;
            let still_idle = self
                .write_last_used
                .get(&connection_id)
                .is_some_and(|last_used| last_used.elapsed() >= WRITE_IDLE_TTL);
            if still_idle {
                self.close_write(connection_id).await;
            }
        }
    }

    pub async fn schema(
        &self,
        connection_id: Uuid,
        info: &ConnectionInfo,
    ) -> Result<Arc<DatabaseSchema>, McpFailure> {
        let expired = self
            .schema_loaded_at
            .get(&connection_id)
            .is_none_or(|loaded_at| loaded_at.elapsed() >= SCHEMA_CACHE_TTL);
        if expired {
            self.schemas.remove(&connection_id);
        }
        let service = MetadataService {
            connections: &self.connections,
            schemas: &self.schemas,
            schema_locks: &self.schema_locks,
        };
        let schema = service
            .get_database_schema(connection_id)
            .await
            .map_err(|error| {
                McpFailure::new(
                    McpErrorCode::QueryFailed,
                    redact(&error.to_string(), &super::encode::sql_secrets(info)),
                )
            })?;
        if expired {
            self.schema_loaded_at.insert(connection_id, Instant::now());
        }
        Ok(schema)
    }

    pub async fn kv_client(
        &self,
        connection_id: Uuid,
        info: &KvConnectionInfo,
    ) -> Result<KvConnection, McpFailure> {
        let fingerprint = fingerprint_of(&info.config)?;
        if self
            .kv_fingerprints
            .get(&connection_id)
            .is_some_and(|current| *current != fingerprint)
        {
            self.kv_connections.remove(&connection_id);
        }
        if let Some(client) = self.kv_connections.get(&connection_id) {
            return Ok(client.value().clone());
        }
        let client = KvConnection::connect(&info.config).await.map_err(|error| {
            McpFailure::new(
                McpErrorCode::ConnectionFailed,
                redact(&error.to_string(), &super::encode::kv_secrets(info)),
            )
        })?;
        self.kv_connections.insert(connection_id, client.clone());
        self.kv_fingerprints.insert(connection_id, fingerprint);
        Ok(client)
    }

    pub async fn shutdown(&self) {
        self.stmt_manager.cancel_active_queries();
        let read_ids: Vec<Uuid> = self.connections.iter().map(|entry| *entry.key()).collect();
        let read_service = ConnectionService {
            connections: &self.connections,
            storage: &self.storage,
        };
        for connection_id in read_ids {
            if let Err(error) = read_service
                .disconnect_from_database(&self.monitor, connection_id)
                .await
            {
                log::debug!("Read session was already closed: {error}");
            }
        }
        let write_ids: Vec<Uuid> = self
            .write_connections
            .iter()
            .map(|entry| *entry.key())
            .collect();
        for connection_id in write_ids {
            self.close_write(connection_id).await;
        }
    }
}

fn fingerprint_of<T: Serialize>(value: &T) -> Result<String, McpFailure> {
    let encoded = serde_json::to_string(value).map_err(|_| McpFailure::internal())?;
    Ok(hash_agent_statements(&[encoded])?)
}

fn connection_failure(message: &str, info: &ConnectionInfo) -> McpFailure {
    McpFailure::new(
        McpErrorCode::ConnectionFailed,
        redact(message, &super::encode::sql_secrets(info)),
    )
}

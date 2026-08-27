use std::{collections::HashMap, sync::Arc, time::Duration};

use tauri::{Emitter, EventTarget, Manager};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{database::postgres::connect::ConnectionCheck, AppState};

type ConnectionId = Uuid;

/// One monitored handle per connection id. Replacing an entry aborts the old
/// handle so a stale check can never evict a freshly reconnected connection.
fn upsert(
    connections: &mut HashMap<ConnectionId, ConnectionCheck>,
    connection_id: ConnectionId,
    conn_check: ConnectionCheck,
) {
    if let Some(old) = connections.insert(connection_id, conn_check) {
        old.abort();
    }
}

/// Removes and returns the ids whose connection task has finished, i.e. the
/// server closed the connection.
fn take_finished(connections: &mut HashMap<ConnectionId, ConnectionCheck>) -> Vec<ConnectionId> {
    let finished: Vec<ConnectionId> = connections
        .iter()
        .filter(|(_, conn_check)| conn_check.inner().is_finished())
        .map(|(connection_id, _)| *connection_id)
        .collect();

    for connection_id in &finished {
        connections.remove(connection_id);
    }

    finished
}

#[derive(Clone)]
pub struct ConnectionMonitor {
    app: tauri::AppHandle,
    connections: Arc<RwLock<HashMap<ConnectionId, ConnectionCheck>>>,
}

impl ConnectionMonitor {
    pub fn new(app: tauri::AppHandle) -> Self {
        let monitor = Self {
            app,
            connections: Arc::new(RwLock::new(HashMap::new())),
        };

        let polling_monitor = monitor.clone();
        tauri::async_runtime::spawn(async move { polling_monitor.poll().await });

        monitor
    }

    pub async fn add_connection(&self, connection_id: Uuid, conn_check: ConnectionCheck) {
        log::info!("Adding connection {connection_id} to ConnectionMonitor");
        upsert(
            &mut *self.connections.write().await,
            connection_id,
            conn_check,
        );
    }

    /// Deregisters a connection on explicit disconnect/delete so its finishing
    /// task is not mistaken for a server-side drop.
    pub async fn remove_connection(&self, connection_id: Uuid) {
        if let Some(conn_check) = self.connections.write().await.remove(&connection_id) {
            log::info!("Removing connection {connection_id} from ConnectionMonitor");
            conn_check.abort();
        }
    }

    fn persist_disconnect(&self, connection_id: Uuid) {
        let Some(state_manager) = self.app.try_state::<AppState>() else {
            log::error!("No state manager found!");
            return;
        };
        let Some(mut connection) = state_manager.connections.get_mut(&connection_id) else {
            log::error!("Connection {connection_id} not found!");
            return;
        };
        connection.connected = false;
        match &mut connection.database {
            crate::database::types::Database::Postgres { client, .. } => *client = None,
            crate::database::types::Database::SQLite {
                connection: sqlite_conn,
                ..
            } => *sqlite_conn = None,
            crate::database::types::Database::DuckDB {
                connection: duckdb_conn,
                ..
            } => *duckdb_conn = None,
            crate::database::types::Database::LibSQL {
                connection: libsql_conn,
                ..
            } => *libsql_conn = None,
            crate::database::types::Database::MySQL {
                pool: mysql_pool, ..
            } => {
                if let Some(old_pool) = mysql_pool.take() {
                    crate::database::services::connection::spawn_mysql_pool_disconnect(
                        (*old_pool).clone(),
                    );
                }
            }
            crate::database::types::Database::D1 {
                connection: d1_conn,
                ..
            } => *d1_conn = None,
            crate::database::types::Database::Posthog {
                connection: posthog_conn,
                ..
            } => *posthog_conn = None,
        }
    }

    fn notify_disconnect(&self, connection_id: Uuid) {
        self.persist_disconnect(connection_id);
        if let Some(refresher) = self.app.try_state::<crate::database::RowCountRefresher>() {
            refresher.cancel(connection_id);
        }
        match self
            .app
            .emit_to(EventTarget::App, "end-of-connection", connection_id)
        {
            Ok(()) => {
                log::info!("End-of-connection event emitted for connection {connection_id}");
            }
            Err(e) => {
                log::error!("Error emitting end-of-connection event: {e}");
            }
        }
    }

    async fn poll(self) {
        loop {
            let dropped_conns = take_finished(&mut *self.connections.write().await);

            for connection_id in dropped_conns {
                self.notify_disconnect(connection_id);
            }

            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn finished_check() -> ConnectionCheck {
        let check = tauri::async_runtime::spawn(async {});
        while !check.inner().is_finished() {
            std::thread::sleep(Duration::from_millis(5));
        }
        check
    }

    fn pending_check() -> ConnectionCheck {
        tauri::async_runtime::spawn(async {
            tokio::time::sleep(Duration::from_secs(300)).await;
        })
    }

    #[test]
    fn fresh_handle_survives_replacing_a_stale_one() {
        let connection_id = Uuid::new_v4();
        let mut connections = HashMap::new();

        upsert(&mut connections, connection_id, finished_check());
        upsert(&mut connections, connection_id, pending_check());

        assert_eq!(connections.len(), 1);
        assert!(take_finished(&mut connections).is_empty());
        assert!(connections.contains_key(&connection_id));
    }

    #[test]
    fn finished_handles_are_reported_and_removed() {
        let finished_id = Uuid::new_v4();
        let pending_id = Uuid::new_v4();
        let mut connections = HashMap::new();

        upsert(&mut connections, finished_id, finished_check());
        upsert(&mut connections, pending_id, pending_check());

        assert_eq!(take_finished(&mut connections), vec![finished_id]);
        assert!(!connections.contains_key(&finished_id));
        assert!(connections.contains_key(&pending_id));
    }
}

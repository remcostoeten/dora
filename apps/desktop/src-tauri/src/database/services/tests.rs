#[cfg(test)]
mod tests {
    use dashmap::DashMap;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    use uuid::Uuid;

    use crate::database::{
        adapter::{BoxedAdapter, BoxedWriteAdapter},
        connection_repository::ConnectionRepository,
        parser::ParsedStatement,
        services::{
            connection::record_last_connected, metadata::MetadataService, query::QueryService,
        },
        stmt_manager::StatementManager,
        types::{
            ConnectionInfo, DatabaseClient, DatabaseConnection, DatabaseInfo, DatabaseSchema,
            QueryStatus,
        },
    };
    use crate::storage::Storage;
    use crate::Error;

    struct EmptyConnectionRepository;

    impl ConnectionRepository for EmptyConnectionRepository {
        fn get_client(&self, connection_id: Uuid) -> Result<DatabaseClient, Error> {
            Err(Error::ConnectionNotFound(connection_id))
        }

        fn get_read_adapter(&self, connection_id: Uuid) -> Result<BoxedAdapter, Error> {
            Err(Error::ConnectionNotFound(connection_id))
        }

        fn get_write_adapter(&self, connection_id: Uuid) -> Result<BoxedWriteAdapter, Error> {
            Err(Error::ConnectionNotFound(connection_id))
        }

        fn parse_statements(
            &self,
            connection_id: Uuid,
            _query: &str,
        ) -> Result<Vec<ParsedStatement>, Error> {
            Err(Error::ConnectionNotFound(connection_id))
        }
    }

    struct SqliteRepository {
        connection: Arc<Mutex<rusqlite::Connection>>,
    }

    impl SqliteRepository {
        fn with_users() -> Self {
            let connection = rusqlite::Connection::open_in_memory().expect("sqlite should open");
            connection
                .execute_batch(
                    "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
                     INSERT INTO users (name) VALUES ('ada'), ('grace'), ('linus');",
                )
                .expect("fixture should load");
            Self {
                connection: Arc::new(Mutex::new(connection)),
            }
        }
    }

    impl ConnectionRepository for SqliteRepository {
        fn get_client(&self, _connection_id: Uuid) -> Result<DatabaseClient, Error> {
            Ok(DatabaseClient::SQLite {
                connection: self.connection.clone(),
            })
        }

        fn parse_statements(
            &self,
            _connection_id: Uuid,
            query: &str,
        ) -> Result<Vec<ParsedStatement>, Error> {
            crate::database::sqlite::parser::parse_statements(query).map_err(Into::into)
        }
    }

    struct TempStorage {
        path: std::path::PathBuf,
        storage: Storage,
    }

    impl TempStorage {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("dora-service-test-{}.sqlite", Uuid::new_v4()));
            let storage = Storage::new(path.clone()).expect("storage should initialize");
            Self { path, storage }
        }
    }

    impl Drop for TempStorage {
        fn drop(&mut self) {
            for suffix in ["", "-wal", "-shm"] {
                let _ = std::fs::remove_file(format!("{}{suffix}", self.path.display()));
            }
        }
    }

    /// Opening a table is one call: the statement runs, is awaited on the
    /// backend, and comes back with its columns, rows and counts.
    #[tokio::test]
    async fn run_query_returns_a_table_page_in_one_call() {
        let repo = SqliteRepository::with_users();
        let temp = TempStorage::new();
        let stmt_manager = StatementManager::new();
        let svc = QueryService {
            connection_repo: &repo,
            storage: &temp.storage,
            stmt_manager: &stmt_manager,
        };

        let result = svc
            .run_query(
                Uuid::new_v4(),
                "SELECT * FROM users ORDER BY id LIMIT 2",
                Duration::from_secs(5),
            )
            .await
            .expect("query should run");

        assert_eq!(result.status, QueryStatus::Completed);
        assert_eq!(result.error, None);
        assert_eq!(
            result.columns.as_ref().map(|columns| columns.get()),
            Some(r#"["id","name"]"#)
        );
        assert_eq!(
            result.first_page.as_ref().map(|page| page.get()),
            Some(r#"[[1,"ada"],[2,"grace"]]"#)
        );
        assert_eq!(result.page_count, 1);
        assert_eq!(result.rows_received, 2);
        assert_eq!(
            stmt_manager.get_query_status(result.query_id).unwrap(),
            QueryStatus::Completed
        );
    }

    /// A failing statement is a result, not a rejected command: the grid shows
    /// the engine's own message, exactly as the polling path did.
    #[tokio::test]
    async fn run_query_reports_a_statement_error_in_the_payload() {
        let repo = SqliteRepository::with_users();
        let temp = TempStorage::new();
        let stmt_manager = StatementManager::new();
        let svc = QueryService {
            connection_repo: &repo,
            storage: &temp.storage,
            stmt_manager: &stmt_manager,
        };

        let result = svc
            .run_query(
                Uuid::new_v4(),
                "SELECT * FROM dropped_table LIMIT 50",
                Duration::from_secs(5),
            )
            .await
            .expect("a failed statement is still a response");

        assert_eq!(result.status, QueryStatus::Error);
        assert_eq!(
            result.error.as_deref(),
            Some("Query failed: no such table: dropped_table")
        );
    }

    #[tokio::test]
    async fn run_query_is_cancelled_with_its_connection() {
        let repo = SqliteRepository::with_users();
        let temp = TempStorage::new();
        let stmt_manager = StatementManager::new();
        let svc = QueryService {
            connection_repo: &repo,
            storage: &temp.storage,
            stmt_manager: &stmt_manager,
        };
        let connection_id = Uuid::new_v4();
        let slow_query = "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 100000000) SELECT count(*) FROM t";

        let (result, ()) = tokio::join!(
            svc.run_query(connection_id, slow_query, Duration::from_secs(30)),
            async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                stmt_manager.cancel_connection_queries(connection_id);
            }
        );
        let result = result.expect("a cancelled statement is still a response");

        assert_eq!(result.status, QueryStatus::Error);
        assert_eq!(result.error.as_deref(), Some("Query cancelled"));
    }

    #[tokio::test]
    async fn run_query_fails_to_start_without_a_connection() {
        let repo = EmptyConnectionRepository;
        let temp = TempStorage::new();
        let stmt_manager = StatementManager::new();
        let svc = QueryService {
            connection_repo: &repo,
            storage: &temp.storage,
            stmt_manager: &stmt_manager,
        };
        let connection_id = Uuid::new_v4();

        let result = svc
            .run_query(connection_id, "SELECT 1", Duration::from_secs(5))
            .await;

        assert!(matches!(result, Err(Error::ConnectionNotFound(id)) if id == connection_id));
    }

    /// The connect command stamps `last_connected_at` after it has replied, so
    /// the stamp has to work as a free function over storage alone.
    #[test]
    fn record_last_connected_stamps_the_saved_connection() {
        let temp = TempStorage::new();
        let id = Uuid::new_v4();
        temp.storage
            .save_connection(&ConnectionInfo {
                id,
                name: "Stamp test".to_string(),
                connected: false,
                database_type: DatabaseInfo::SQLite {
                    db_path: ":memory:".to_string(),
                },
                last_connected_at: None,
                created_at: None,
                updated_at: None,
                pin_hash: None,
                favorite: None,
                color: None,
                sort_order: None,
            })
            .expect("connection should save");

        let before = temp
            .storage
            .get_connection(&id)
            .expect("connection should load")
            .expect("connection should exist");
        assert_eq!(before.last_connected_at, None);

        record_last_connected(&temp.storage, id);

        let after = temp
            .storage
            .get_connection(&id)
            .expect("connection should load")
            .expect("connection should exist");
        assert!(after.last_connected_at.is_some());
    }

    /// Test that MetadataService can be constructed without any Tauri types
    #[test]
    fn test_metadata_service_isolation() {
        // Create minimal dependencies - no Tauri, no AppState
        let connections: DashMap<Uuid, DatabaseConnection> = DashMap::new();
        let schemas: DashMap<Uuid, Arc<DatabaseSchema>> = DashMap::new();
        let schema_locks: DashMap<Uuid, Arc<tokio::sync::Mutex<()>>> = DashMap::new();

        // Construct the service with explicit dependencies
        let _svc = MetadataService {
            connections: &connections,
            schemas: &schemas,
            schema_locks: &schema_locks,
        };

        // Service constructed successfully without Tauri runtime
        assert!(true);
    }

    /// Test that MutationService can be constructed without Tauri
    #[test]
    fn test_mutation_service_isolation() {
        use crate::database::services::mutation::MutationService;

        let connection_repo = EmptyConnectionRepository;
        let schemas: DashMap<Uuid, Arc<DatabaseSchema>> = DashMap::new();

        let _svc = MutationService {
            connection_repo: &connection_repo,
            schemas: &schemas,
        };

        assert!(true);
    }
}

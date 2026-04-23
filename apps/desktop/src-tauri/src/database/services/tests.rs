#[cfg(test)]
mod tests {
    use dashmap::DashMap;
    use std::sync::Arc;
    use uuid::Uuid;

    use crate::database::{
        adapter::{BoxedAdapter, BoxedWriteAdapter},
        connection_repository::ConnectionRepository,
        parser::ParsedStatement,
        services::metadata::MetadataService,
        types::{DatabaseClient, DatabaseConnection, DatabaseInfo, DatabaseSchema},
    };
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

    /// Test that MetadataService can be constructed without any Tauri types
    #[test]
    fn test_metadata_service_isolation() {
        // Create minimal dependencies - no Tauri, no AppState
        let connections: DashMap<Uuid, DatabaseConnection> = DashMap::new();
        let schemas: DashMap<Uuid, Arc<DatabaseSchema>> = DashMap::new();

        // Construct the service with explicit dependencies
        let _svc = MetadataService {
            connections: &connections,
            schemas: &schemas,
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

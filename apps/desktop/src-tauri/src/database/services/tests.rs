#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use dashmap::DashMap;
    use uuid::Uuid;
    
    use crate::database::{
        services::metadata::MetadataService,
        types::{DatabaseConnection, DatabaseInfo, DatabaseSchema},
    };

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
        
        let connections: DashMap<Uuid, DatabaseConnection> = DashMap::new();
        let schemas: DashMap<Uuid, Arc<DatabaseSchema>> = DashMap::new();

        let _svc = MutationService {
            connections: &connections,
            schemas: &schemas,
        };

        assert!(true);
    }
}

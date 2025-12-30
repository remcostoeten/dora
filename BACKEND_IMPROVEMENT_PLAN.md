# Backend Architecture Improvement Plan

## Executive Summary

Based on a comprehensive audit of the Dora Tauri backend, I've identified critical architectural improvements needed to support migration to a Next.js spreadsheet-style frontend. The current backend has solid foundations but requires significant refactoring for better maintainability, testability, and migration readiness.

## Current Architecture Assessment

### Strengths ✅
- **Clean Database Abstraction**: Good separation between PostgreSQL and SQLite implementations
- **Security Implementation**: AES-256 encryption with OS keyring integration
- **SQL Parsing**: Robust SQL parsing with `sqlparser` crate
- **Command System**: Efficient keyboard shortcut system with O(1) lookup
- **Streaming**: Pagination support with 50-row batch processing

### Critical Issues ❌
- **Monolithic Commands**: 40+ commands in single 800-line file (`database/commands.rs`)
- **Tight Tauri Coupling**: Business logic mixed with UI framework code
- **Inconsistent Error Handling**: Mix of custom errors and `anyhow::Error`
- **Limited Database Support**: Only PostgreSQL and SQLite
- **Poor Testability**: Hard to test business logic in isolation
- **No Connection Pooling**: Poor performance under concurrent load

## Detailed Improvement Plan

### Phase 1: Architectural Refactoring (Week 1-2)

#### 1.1 Command System Decomposition
**Current**: Single massive file with 40+ commands
**Target**: Domain-specific command modules

```rust
// Proposed Structure
src-tauri/src/
├── domain/
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── connection.rs    # Connection management
│   │   ├── query.rs        # Query execution & results
│   │   ├── schema.rs       # Schema introspection
│   │   ├── script.rs       # Saved scripts & history
│   │   └── settings.rs     # App settings & config
│   ├── services/
│   │   ├── connection_service.rs
│   │   ├── query_service.rs
│   │   ├── schema_service.rs
│   │   └── script_service.rs
│   └── repositories/
│       ├── connection_repository.rs
│       ├── query_repository.rs
│       └── schema_repository.rs
```

#### 1.2 Service Layer Extraction
Extract business logic from Tauri commands into pure service functions:

```rust
// Example Service
pub struct ConnectionService {
    connection_repo: Arc<dyn ConnectionRepository>,
    credential_manager: Arc<dyn CredentialManager>,
}

impl ConnectionService {
    pub async fn create_connection(
        &self,
        request: CreateConnectionRequest,
    ) -> Result<ConnectionInfo> {
        // Pure business logic - no Tauri dependencies
    }
}
```

#### 1.3 Error Handling Standardization
Replace inconsistent error handling with domain-specific errors:

```rust
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("Connection failed: {source}")]
    ConnectionFailed { source: String },

    #[error("Query execution failed: {query}")]
    QueryFailed { query: String, source: String },

    #[error("Schema introspection failed: {table}")]
    SchemaError { table: String, source: String },

    #[error("Authentication failed: {reason}")]
    AuthenticationFailed { reason: String },
}
```

### Phase 2: API Layer Development (Week 3-4)

#### 2.1 Web Framework Integration
Add Axum/Warp layer alongside Tauri commands:

```rust
// Shared Service Interface
pub trait QueryService {
    async fn execute_query(&self, req: ExecuteQueryRequest) -> Result<QueryResult>;
    async fn get_query_status(&self, query_id: QueryId) -> Result<QueryStatus>;
}

// Tauri Adapter
pub struct TauriQueryHandler {
    service: Arc<dyn QueryService>,
}

#[tauri::command]
pub async fn execute_query_tauri(
    request: ExecuteQueryRequest,
    state: tauri::State<'_, AppState>,
) -> Result<QueryResult, DomainError> {
    state.query_service.execute_query(request).await
}

// Web API Adapter
pub struct WebQueryHandler {
    service: Arc<dyn QueryService>,
}

#[post("/api/queries")]
pub async fn execute_query_web(
    Json(request): Json<ExecuteQueryRequest>,
    Extension(service): Extension<Arc<dyn QueryService>>,
) -> Result<Json<QueryResult>, ApiError> {
    let result = service.execute_query(request).await?;
    Ok(Json(result))
}
```

#### 2.2 Authentication & Authorization
Implement web-ready auth system:

```rust
pub struct AuthService {
    jwt_secret: String,
    user_repo: Arc<dyn UserRepository>,
}

#[derive(Debug, Serialize)]
pub struct AuthContext {
    pub user_id: Uuid,
    pub session_id: String,
    pub permissions: Vec<Permission>,
}

// Middleware for API endpoints
pub async fn auth_middleware(
    req: Request<Body>,
    next: Next<Body>,
) -> Result<Response, ApiError> {
    // JWT validation, session management, rate limiting
}
```

### Phase 3: Database Enhancements (Week 5-6)

#### 3.1 Extensible Database Adapter System
Design for future database support:

```rust
#[async_trait]
pub trait DatabaseAdapter: Send + Sync {
    type Config: Clone + Send + Sync;
    type Connection: Send + Sync;

    async fn connect(&self, config: Self::Config) -> Result<Self::Connection>;
    async fn execute_query(&self, conn: &Self::Connection, query: &str) -> Result<QueryResult>;
    async fn get_schema(&self, conn: &Self::Connection) -> Result<DatabaseSchema>;
    async fn get_tables(&self, conn: &Self::Connection) -> Result<Vec<TableInfo>>;
    fn database_type(&self) -> DatabaseType;
}

// Registry Pattern for Database Types
pub struct DatabaseRegistry {
    adapters: HashMap<DatabaseType, Box<dyn DatabaseAdapter<Config = DatabaseConfig>>>,
}

impl DatabaseRegistry {
    pub fn register_adapter<T: DatabaseAdapter>(&mut self, adapter: T) {
        self.adapters.insert(adapter.database_type(), Box::new(adapter));
    }
}
```

#### 3.2 Connection Pooling
Implement proper connection pooling:

```rust
pub struct ConnectionPool {
    pools: DashMap<Uuid, Arc<dyn PoolAdapter>>,
}

#[async_trait]
pub trait PoolAdapter {
    async fn get_connection(&self) -> Result<Box<dyn Connection>>;
    async fn return_connection(&self, conn: Box<dyn Connection>);
    fn stats(&self) -> PoolStats;
}

// PostgreSQL Pool Implementation
pub struct PostgresPool {
    pool: deadpool::managed::Pool<PostgresConnectionManager>,
}

// SQLite Pool Implementation
pub struct SqlitePool {
    connections: Arc<Mutex<Vec<SqliteConnection>>>,
    max_size: usize,
}
```

#### 3.3 Performance Optimizations
Add intelligent caching and streaming improvements:

```rust
pub struct SchemaCache {
    cache: Arc<Mutex<LruCache<String, CachedSchema>>>,
    ttl: Duration,
}

pub struct CachedSchema {
    schema: DatabaseSchema,
    cached_at: Instant,
    version: u64,
}

// Enhanced Streaming with Backpressure
pub struct QueryStreamer {
    sender: mpsc::Sender<Page>,
    buffer_size: usize,
    backpressure_threshold: f32,
}
```

### Phase 4: Testing Infrastructure (Week 7)

#### 4.1 Test Architecture
Implement comprehensive testing strategy:

```rust
// Domain Layer Tests (Unit Tests)
#[cfg(test)]
mod tests {
    use super::*;
    use mockall::mock;

    mock! {
        ConnectionRepository {}

        #[async_trait]
        impl ConnectionRepositoryTrait for ConnectionRepository {
            async fn save(&self, connection: &ConnectionInfo) -> Result<()>;
            async fn find_by_id(&self, id: Uuid) -> Result<Option<ConnectionInfo>>;
        }
    }

    #[tokio::test]
    async fn test_create_connection_success() {
        let mut mock_repo = MockConnectionRepository::new();
        // Test setup and assertions
    }
}

// Integration Tests
#[cfg(test)]
mod integration_tests {
    use testcontainers::{clients::Cli, images::postgres::Postgres, Container};

    #[tokio::test]
    async fn test_postgres_connection_lifecycle() {
        // Real database testing with testcontainers
    }
}

// API Tests
#[cfg(test)]
mod api_tests {
    use axum_test::TestServer;

    #[tokio::test]
    async fn test_execute_query_endpoint() {
        // HTTP endpoint testing
    }
}
```

#### 4.2 Test Utilities
Provide testing helpers and fixtures:

```rust
// Test Database Factory
pub struct TestDatabaseFactory {
    postgres_container: Option<Container<'static, Postgres>>,
    sqlite_db: Option<tempfile::TempPath>,
}

impl TestDatabaseFactory {
    pub async fn create_postgres(&self) -> Result<PostgresConfig> {
        // Spin up test PostgreSQL container
    }

    pub async fn create_sqlite(&self) -> Result<SqliteConfig> {
        // Create in-memory SQLite database
    }
}

// Mock Data Generators
pub mod fixtures {
    use fake::{Fake, Faker};

    pub fn fake_connection_info() -> ConnectionInfo {
        ConnectionInfo {
            id: Faker.fake(),
            name: Faker.fake(),
            // ... other fields
        }
    }
}
```

### Phase 5: Migration Preparation (Week 8)

#### 5.1 Configuration Management
Externalize configuration and environment-specific settings:

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub security: SecurityConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub default_pool_size: usize,
    pub query_timeout: Duration,
    pub schema_cache_ttl: Duration,
    pub max_result_rows: usize,
}

// Environment-specific configs
impl AppConfig {
    pub fn from_env() -> Result<Self> {
        // Load from .env files, environment variables
    }

    pub fn for_test() -> Self {
        // Test-specific configuration
    }
}
```

#### 5.2 Feature Flags
Implement feature flag system for gradual migration:

```rust
pub struct FeatureFlags {
    pub enable_web_api: bool,
    pub enable_auth: bool,
    pub enable_connection_pooling: bool,
    pub enable_schema_caching: bool,
}

impl FeatureFlags {
    pub fn from_env() -> Self {
        Self {
            enable_web_api: std::env::var("ENABLE_WEB_API")
                .unwrap_or_default()
                .parse()
                .unwrap_or(false),
            // ... other flags
        }
    }
}
```

## Spreadsheet-Specific Features Preparation

Based on your mention of spreadsheet-style UI with context menus, here are backend preparations needed:

### 1. Enhanced CRUD Operations
```rust
pub struct SpreadsheetService {
    query_service: Arc<dyn QueryService>,
    schema_service: Arc<dyn SchemaService>,
}

impl SpreadsheetService {
    // Cell-level operations
    pub async fn update_cell_value(
        &self,
        table: String,
        row_id: String,
        column: String,
        value: Value,
    ) -> Result<UpdateResult>;

    // Row operations
    pub async fn delete_rows(
        &self,
        table: String,
        row_ids: Vec<String>,
    ) -> Result<DeleteResult>;

    // Bulk operations
    pub async fn bulk_insert(
        &self,
        table: String,
        rows: Vec<RowData>,
    ) -> Result<BulkInsertResult>;

    // Export operations
    pub async fn export_table(
        &self,
        table: String,
        format: ExportFormat,
    ) -> Result<ExportResult>;
}
```

### 2. Permission System
```rust
pub struct PermissionService {
    user_permissions: DashMap<Uuid, Vec<Permission>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Permission {
    ReadTable { table: String },
    WriteTable { table: String },
    DeleteTable { table: String },
    ManageConnections,
    ExportData,
}

pub struct SecurityContext {
    pub user_id: Uuid,
    pub session_id: String,
    pub permissions: Vec<Permission>,
    pub connection_access: HashMap<Uuid, AccessLevel>,
}
```

### 3. Real-time Updates
```rust
pub struct RealtimeService {
    connections: DashMap<Uuid, WebSocketConnection>,
    subscriptions: DashMap<String, Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub enum RealtimeEvent {
    TableChanged { table: String, change_type: ChangeType },
    CellUpdated { table: String, row_id: String, column: String, value: Value },
    RowDeleted { table: String, row_id: String },
    ConnectionStatusChanged { connection_id: Uuid, status: ConnectionStatus },
}
```

## Implementation Timeline

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1-2 | Architectural Refactoring | Service layer, command decomposition, error handling |
| 3-4 | API Layer | Web framework, authentication, REST endpoints |
| 5-6 | Database Enhancements | Connection pooling, multi-DB support, caching |
| 7 | Testing Infrastructure | Unit/integration tests, test utilities |
| 8 | Migration Prep | Configuration, feature flags, documentation |

## Success Metrics

- **Code Quality**: Reduce cyclomatic complexity by 50%
- **Test Coverage**: Achieve 80%+ coverage for business logic
- **Performance**: Support 100+ concurrent database connections
- **Migration Readiness**: 100% of business logic testable without Tauri
- **Maintainability**: Average file size < 300 lines

## Risk Mitigation

### Technical Risks
- **Breaking Changes**: Maintain backward compatibility during refactoring
- **Performance Degradation**: Implement performance benchmarks
- **Complexity Increase**: Use incremental refactoring approach

### Migration Risks
- **Data Loss**: Comprehensive backup and migration testing
- **Feature Regression**: Maintain feature parity testing
- **Security Issues**: Security audit of web API layer

## Conclusion

This architectural improvement plan transforms the current monolithic Tauri backend into a clean, testable, and migration-ready system. The key benefits include:

1. **Better Separation of Concerns**: Clear distinction between business logic and UI framework
2. **Enhanced Testability**: Business logic testable in isolation
3. **Migration Readiness**: Easy to expose the same functionality via web APIs
4. **Future-Proof Design**: Extensible database support and feature flags
5. **Improved Performance**: Connection pooling and intelligent caching

The phased approach minimizes risk while delivering immediate improvements in code quality and maintainability. By the end of this refactoring, you'll have a robust backend that can seamlessly serve both the current Tauri frontend and the new Next.js spreadsheet interface.

## Execution Recap (Phase 1 Refactoring - Implemented)

### 1. File and Module Changes
- **Split:** Monolithic `commands.rs` -> `src-tauri/src/database/services/`.
- **New Modules:** `connection.rs`, `query.rs`, `mutation.rs`, `metadata.rs`, `mod.rs`.
- **Current Structure:**
    ```text
    src-tauri/src/database/
    ├── commands.rs         (Facade layer)
    └── services/           (Business logic)
        ├── connection.rs
        ├── query.rs
        ├── mutation.rs
        └── metadata.rs
    ```

### 2. Service Layer Status
- **Architecture:** Static service methods (e.g., `QueryService::start_query`).
- **Dependencies:** `AppState` (connections, storage, stmt_manager).
- **Role:** Pure business logic; `commands.rs` handles Tauri-specific argument parsing.

### 3. RPC Surface
- **Compatibility:** All existing Tauri command names/signatures preserved 1:1.
- **New Commands:**
    - `insert_row`: Structured single-row insertion.
    - `execute_batch`: Transactional execution of multiple SQL statements.

### 4. Behavior & Features
- **Parity:** Functional parity maintained for all existing operations.
- **Enhancements:** 
    - Auto-detection of soft delete columns.
    - Transaction support via `execute_batch`.
- **Gaps:** LibSQL `dump_database` remains unimplemented.

### 5. Future Readiness
- **Testing:** Service methods are now decoupled from Tauri runtime, enabling direct unit testing.
- **Migration:** New `insert_row` and batching align with the spreadsheet UI requirements.
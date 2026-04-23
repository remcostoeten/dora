//! Database adapter traits — per-engine driver abstractions.
//!
//! - `read` — query execution, schema introspection, connection probe.
//! - `write` — row mutations, truncate, soft-delete, dump.
//!   Per-driver impls in `write_postgres`, `write_sqlite`, `write_mysql`, `write_libsql`.
//! - `watch` (planned Phase 5c) — live change monitoring per driver.

pub mod read;
pub mod write;
mod write_libsql;
mod write_mysql;
mod write_postgres;
mod write_sqlite;

pub use read::{
    adapter_from_client, BoxedAdapter, DatabaseAdapter, DatabaseType, LibSqlAdapter, MySqlAdapter,
    PostgresAdapter, SqliteAdapter,
};
pub use write::{write_adapter_from_client, BoxedWriteAdapter, WriteAdapter};

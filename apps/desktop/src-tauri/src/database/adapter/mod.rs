//! Database adapter traits — per-engine driver abstractions.
//!
//! - `read` — query execution, schema introspection, connection probe.
//! - `write` — row mutations, truncate, soft-delete, dump.
//!   Per-driver impls in `write_postgres`, `write_sqlite`, `write_mysql`, `write_libsql`.
//! - `watch` — live change monitoring per driver.

pub mod duckdb_proxy;
pub mod read;
pub mod watch;
pub mod write;
mod write_d1;
#[cfg(feature = "duckdb-engine")]
mod write_duckdb;
mod write_libsql;
mod write_mysql;
mod write_posthog;
mod write_postgres;
mod write_sqlite;

pub use duckdb_proxy::DuckDbConnAdapter;
#[cfg(feature = "duckdb-engine")]
pub use read::DuckDbAdapter;
pub use read::{
    adapter_from_client, BoxedAdapter, DatabaseAdapter, DatabaseType, LibSqlAdapter, MySqlAdapter,
    PostgresAdapter, SqliteAdapter,
};
pub use watch::{watch_adapter_from_client, BoxedWatchAdapter, WatchAdapter};
pub use write::{write_adapter_from_client, BoxedWriteAdapter, WriteAdapter};

//! Database adapter traits — per-engine driver abstractions.
//!
//! - `read` — query execution, schema introspection, connection probe.
//! - `write` — row mutations, truncate, soft-delete, dump. Stub impls in
//!   Phase 5a; real bodies ported from `services::mutation` / `database::maintenance`
//!   in Phase 5b.
//! - `watch` (planned Phase 5c) — live change monitoring per driver.

pub mod read;
pub mod write;

pub use read::{
    adapter_from_client, BoxedAdapter, DatabaseAdapter, DatabaseType, LibSqlAdapter, MySqlAdapter,
    PostgresAdapter, SqliteAdapter,
};
pub use write::WriteAdapter;

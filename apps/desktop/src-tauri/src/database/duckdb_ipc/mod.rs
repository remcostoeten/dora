//! Out-of-process DuckDB transport.
//!
//! The [`proto`] module defines the serde wire types and [`framing`] the
//! length-prefixed JSON transport. [`client`] drives a lazily-spawned helper
//! child from the main app via [`client::IpcDuckDbConn`]; [`helper`] is the
//! serving side that runs the real in-process engine. See
//! `docs/duckdb-helper-process.md`.
//!
//! Phase 4a keeps DuckDB bundled and selects the in-process backend by default;
//! set `DORA_DUCKDB_IPC=1` to route connections through the helper. Phase 4b
//! moves the engine-linking half out into a separate crate so the main binary
//! no longer links DuckDB at all.

pub mod client;
pub mod framing;
#[cfg(feature = "duckdb-engine")]
pub mod helper;
pub mod proto;

use crate::database::types::QueryExecEvent;
use proto::StreamEvent;

impl From<QueryExecEvent> for StreamEvent {
    fn from(e: QueryExecEvent) -> Self {
        match e {
            QueryExecEvent::TypesResolved { columns } => StreamEvent::TypesResolved { columns },
            QueryExecEvent::Page { page_amount, page } => StreamEvent::Page { page_amount, page },
            QueryExecEvent::Finished {
                elapsed_ms,
                affected_rows,
                error,
            } => StreamEvent::Finished {
                elapsed_ms,
                affected_rows,
                error,
            },
        }
    }
}

impl From<StreamEvent> for QueryExecEvent {
    fn from(e: StreamEvent) -> Self {
        match e {
            StreamEvent::TypesResolved { columns } => QueryExecEvent::TypesResolved { columns },
            StreamEvent::Page { page_amount, page } => QueryExecEvent::Page { page_amount, page },
            StreamEvent::Finished {
                elapsed_ms,
                affected_rows,
                error,
            } => QueryExecEvent::Finished {
                elapsed_ms,
                affected_rows,
                error,
            },
        }
    }
}

/// Whether DuckDB connections should be routed through the helper process.
/// Kept for compatibility with older dev scripts; the default app path now
/// always uses IPC.
pub fn ipc_enabled() -> bool {
    matches!(
        std::env::var("DORA_DUCKDB_IPC").ok().as_deref(),
        Some("1") | Some("true")
    )
}

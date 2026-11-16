pub mod ai;
pub mod bootstrap;
pub mod connections;
pub mod integrations;
pub mod live_monitor;
pub mod mutation;
pub mod query;
pub mod query_builder;
pub mod schema;
pub mod schema_export;
pub mod scripts;
pub mod seeding;
pub mod settings;
pub mod snippet_folders;
pub mod snippets;
pub mod storage;

pub use ai::*;
pub use bootstrap::*;
pub use connections::*;
pub use integrations::*;
pub use live_monitor::*;
pub use mutation::*;
pub use query::*;
pub use query_builder::*;
pub use schema::*;
pub use schema_export::*;
pub use scripts::*;
pub use seeding::*;
pub use settings::*;
pub use snippet_folders::*;
pub use snippets::*;
pub use storage::*;

/// Runs `work` on the blocking pool so the calling command can reply without
/// waiting for it. Storage writes are synced SQLite commits, a few
/// milliseconds each, and bookkeeping such as a last-connected stamp or the
/// schema mirror does not have to land before the renderer gets its answer.
pub(crate) fn run_off_reply_path(
    app: &tauri::AppHandle,
    work: impl FnOnce(&crate::AppState) + Send + 'static,
) {
    use tauri::Manager;

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(state) = app.try_state::<crate::AppState>() {
            work(state.inner());
        }
    });
}

// Type re-exports preserved for external use (frontend bindings, maintenance.rs consumers).
pub use crate::database::metadata::DatabaseMetadata;
pub use crate::database::services::mutation::{json_to_pg_param, json_to_sqlite_value};
pub use crate::database::services::mutation::{ExportFormat, MutationResult};
pub use crate::database::services::seeding::SeedResult;

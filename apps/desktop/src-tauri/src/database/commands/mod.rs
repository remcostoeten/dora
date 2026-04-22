pub mod ai;
pub mod connections;
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

pub use ai::*;
pub use connections::*;
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

// Type re-exports preserved for external use (frontend bindings, maintenance.rs consumers).
pub use crate::database::metadata::DatabaseMetadata;
pub use crate::database::services::mutation::{ExportFormat, MutationResult};
pub use crate::database::services::mutation::{json_to_pg_param, json_to_sqlite_value};
pub use crate::database::services::seeding::SeedResult;

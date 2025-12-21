//! Commands System Module
//! 
//! Provides a centralized command registry with keyboard shortcut support.
//! Commands can be executed via the command palette or keyboard shortcuts.

mod types;
mod registry;
mod commands;

pub use types::*;
pub use registry::CommandRegistry;
pub use commands::*;

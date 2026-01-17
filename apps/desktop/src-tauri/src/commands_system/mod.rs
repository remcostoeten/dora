//! Commands System Module
//! 
//! Provides a centralized command registry with keyboard shortcut support.
//! Commands can be executed via the command palette or keyboard shortcuts.

pub mod types;
pub mod registry;
mod commands;

pub use types::{CommandDefinition, ShortcutDefinition, StoredShortcut};
pub use registry::CommandRegistry;
pub use commands::*;

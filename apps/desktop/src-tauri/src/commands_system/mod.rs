//! Commands System Module
//!
//! Provides a centralized command registry with keyboard shortcut support.
//! Commands can be executed via the command palette or keyboard shortcuts.

mod commands;
pub mod registry;
pub mod types;

pub use commands::*;
pub use registry::CommandRegistry;
pub use types::{CommandDefinition, ShortcutDefinition, StoredShortcut};

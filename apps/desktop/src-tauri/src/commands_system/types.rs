//! Type definitions for the commands system

use serde::{Deserialize, Serialize};

/// Represents a keyboard shortcut definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutDefinition {
    /// Keys in the shortcut, e.g., ["Ctrl", "N"] or ["Ctrl", "Shift", "N"]
    pub keys: Vec<String>,
    /// Whether this shortcut is currently enabled
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

impl ShortcutDefinition {
    pub fn new(keys: Vec<&str>) -> Self {
        Self {
            keys: keys.into_iter().map(String::from).collect(),
            enabled: true,
        }
    }
    
    /// Format the shortcut for display, e.g., "Ctrl+N"
    pub fn display(&self) -> String {
        self.keys.join("+")
    }
}

/// A command that can be executed via palette or shortcut
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandDefinition {
    /// Unique identifier, e.g., "connections.new"
    pub id: String,
    /// Display name, e.g., "New Connection"
    pub name: String,
    /// Brief description of what the command does
    pub description: String,
    /// Category for grouping in palette, e.g., "Connections", "Queries"
    pub category: String,
    /// Optional keyboard shortcut
    pub shortcut: Option<ShortcutDefinition>,
}

impl CommandDefinition {
    pub fn new(id: &str, name: &str, description: &str, category: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            description: description.to_string(),
            category: category.to_string(),
            shortcut: None,
        }
    }
    
    pub fn with_shortcut(mut self, keys: Vec<&str>) -> Self {
        self.shortcut = Some(ShortcutDefinition::new(keys));
        self
    }
}

/// Stored shortcut binding (from database)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredShortcut {
    pub command_id: String,
    pub keys: Vec<String>,
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_shortcut_display() {
        let shortcut = ShortcutDefinition::new(vec!["Ctrl", "Shift", "N"]);
        assert_eq!(shortcut.display(), "Ctrl+Shift+N");
    }
    
    #[test]
    fn test_command_builder() {
        let cmd = CommandDefinition::new(
            "test.cmd",
            "Test Command",
            "A test command",
            "Testing"
        ).with_shortcut(vec!["Ctrl", "T"]);
        
        assert_eq!(cmd.id, "test.cmd");
        assert!(cmd.shortcut.is_some());
        assert_eq!(cmd.shortcut.unwrap().display(), "Ctrl+T");
    }
}

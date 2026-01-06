//! Command Registry
//! 
//! Central registry for all available commands with O(1) lookup.

use std::collections::HashMap;
use super::types::{CommandDefinition, ShortcutDefinition};

/// Central registry of all available commands
#[derive(Debug, Default)]
pub struct CommandRegistry {
    /// Commands indexed by ID for fast lookup
    commands: HashMap<String, CommandDefinition>,
    /// Index of shortcuts to command IDs for keyboard matching
    shortcut_index: HashMap<String, String>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        let mut registry = Self::default();
        registry.register_default_commands();
        registry
    }
    
    /// Register default commands for the application
    fn register_default_commands(&mut self) {
        // Palette
        self.register(
            CommandDefinition::new(
                "palette.open",
                "Open Command Palette",
                "Search and execute commands",
                "General"
            ).with_shortcut(vec!["Ctrl", "P"])
        );
        
        // Theme
        self.register(
            CommandDefinition::new(
                "theme.toggle",
                "Toggle Theme",
                "Switch between light and dark mode",
                "Appearance"
            ).with_shortcut(vec!["Ctrl", "T"])
        );
        
        // Connections
        self.register(
            CommandDefinition::new(
                "connections.new",
                "New Connection",
                "Create a new database connection",
                "Connections"
            ).with_shortcut(vec!["Ctrl", "N"])
        );
        
        // Queries
        self.register(
            CommandDefinition::new(
                "queries.run",
                "Run Query",
                "Execute the current SQL query",
                "Queries"
            ).with_shortcut(vec!["Ctrl", "Enter"])
        );
        
        self.register(
            CommandDefinition::new(
                "queries.save",
                "Save Script",
                "Save the current script",
                "Queries"
            ).with_shortcut(vec!["Ctrl", "S"])
        );
        
        self.register(
            CommandDefinition::new(
                "scripts.new",
                "New Script",
                "Create a new SQL script",
                "Queries"
            ).with_shortcut(vec!["Ctrl", "Shift", "N"])
        );
        
        // Editor
        self.register(
            CommandDefinition::new(
                "editor.format",
                "Format SQL",
                "Format the current SQL query",
                "Editor"
            ).with_shortcut(vec!["Ctrl", "Shift", "F"])
        );
        
        // View
        self.register(
            CommandDefinition::new(
                "view.sidebar",
                "Toggle Sidebar",
                "Show or hide the sidebar",
                "View"
            ).with_shortcut(vec!["Ctrl", "B"])
        );

        // Navigation
        self.register(
            CommandDefinition::new(
                "nav.home",
                "Go to Home",
                "Navigate to the home dashboard",
                "Navigation"
            )
        );

        self.register(
            CommandDefinition::new(
                "nav.settings",
                "Open Settings",
                "Navigate to application settings",
                "Navigation"
            )
        );

        // Application
        self.register(
            CommandDefinition::new(
                "app.reload",
                "Reload Window",
                "Reload the application window",
                "Application"
            ).with_shortcut(vec!["Ctrl", "R"])
        );

        // Data
        self.register(
            CommandDefinition::new(
                "data.refresh",
                "Refresh Data",
                "Refresh current view data",
                "Data"
            ).with_shortcut(vec!["Ctrl", "Shift", "R"])
        );

        // Tabs
        self.register(
            CommandDefinition::new(
                "tabs.close",
                "Close Tab",
                "Close the current tab",
                "Tabs"
            ).with_shortcut(vec!["Ctrl", "W"])
        );

        self.register(
            CommandDefinition::new(
                "tabs.next",
                "Next Tab",
                "Switch to the next tab",
                "Tabs"
            ).with_shortcut(vec!["Ctrl", "Tab"])
        );
    }
    
    /// Register a command
    pub fn register(&mut self, command: CommandDefinition) {
        // If overwriting an existing command, remove its old shortcut mapping first
        if let Some(existing) = self.commands.get(&command.id) {
            if let Some(ref old_shortcut) = existing.shortcut {
                if old_shortcut.enabled {
                    let old_key = Self::shortcut_key(&old_shortcut.keys);
                    self.shortcut_index.remove(&old_key);
                }
            }
        }
        
        // Index the shortcut if present
        if let Some(ref shortcut) = command.shortcut {
            if shortcut.enabled {
                let key = Self::shortcut_key(&shortcut.keys);
                self.shortcut_index.insert(key, command.id.clone());
            }
        }
        
        self.commands.insert(command.id.clone(), command);
    }
    
    /// Get a command by ID
    pub fn get(&self, id: &str) -> Option<&CommandDefinition> {
        self.commands.get(id)
    }
    
    /// Get all commands
    pub fn all(&self) -> Vec<&CommandDefinition> {
        self.commands.values().collect()
    }
    
    /// Get all commands as owned values (for serialization)
    pub fn all_owned(&self) -> Vec<CommandDefinition> {
        self.commands.values().cloned().collect()
    }
    
    /// Find command by shortcut keys
    pub fn find_by_shortcut(&self, keys: &[String]) -> Option<&CommandDefinition> {
        let key = Self::shortcut_key(keys);
        self.shortcut_index.get(&key)
            .and_then(|id| self.commands.get(id))
    }
    
    /// Update a command's shortcut
    pub fn update_shortcut(&mut self, command_id: &str, shortcut: Option<ShortcutDefinition>) {
        // Remove old shortcut from index
        if let Some(cmd) = self.commands.get(command_id) {
            if let Some(ref old_shortcut) = cmd.shortcut {
                let old_key = Self::shortcut_key(&old_shortcut.keys);
                self.shortcut_index.remove(&old_key);
            }
        }
        
        // Update command
        if let Some(cmd) = self.commands.get_mut(command_id) {
            if let Some(ref new_shortcut) = shortcut {
                if new_shortcut.enabled {
                    let key = Self::shortcut_key(&new_shortcut.keys);
                    self.shortcut_index.insert(key, command_id.to_string());
                }
            }
            cmd.shortcut = shortcut;
        }
    }
    
    /// Generate a normalized key for shortcut lookup
    fn shortcut_key(keys: &[String]) -> String {
        // Sort modifiers first (Ctrl, Shift, Alt), then the main key
        let mut parts: Vec<String> = keys.iter()
            .map(|k| k.to_lowercase())
            .collect();
        parts.sort_by(|a, b| {
            let order = |s: &str| match s {
                "ctrl" | "control" => 0,
                "shift" => 1,
                "alt" => 2,
                "meta" | "cmd" | "command" => 3,
                _ => 4,
            };
            order(a).cmp(&order(b))
        });
        parts.join("+")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_registry_creation() {
        let registry = CommandRegistry::new();
        assert!(registry.get("palette.open").is_some());
        assert!(registry.get("theme.toggle").is_some());
        assert!(registry.get("connections.new").is_some());
    }
    
    #[test]
    fn test_shortcut_lookup() {
        let registry = CommandRegistry::new();
        let keys = vec!["Ctrl".to_string(), "P".to_string()];
        let cmd = registry.find_by_shortcut(&keys);
        assert!(cmd.is_some());
        assert_eq!(cmd.unwrap().id, "palette.open");
    }
    
    #[test]
    fn test_shortcut_key_normalization() {
        // Order shouldn't matter
        let key1 = CommandRegistry::shortcut_key(&["Ctrl".to_string(), "Shift".to_string(), "N".to_string()]);
        let key2 = CommandRegistry::shortcut_key(&["Shift".to_string(), "Ctrl".to_string(), "N".to_string()]);
        assert_eq!(key1, key2);
    }
}

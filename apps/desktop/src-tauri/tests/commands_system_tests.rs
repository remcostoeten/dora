//! Integration tests for the commands system module.
//!
//! This module tests the command registry and keyboard shortcut functionality
//! provided by [`app_lib::commands_system`]. These tests verify command
//! types and shortcut handling.
//!
//! # Source Modules
//! - [`app_lib::commands_system::registry`](../src/commands_system/registry.rs)
//! - [`app_lib::commands_system::types`](../src/commands_system/types.rs)

use app_lib::commands_system::{CommandRegistry, CommandDefinition, ShortcutDefinition};

#[test]
fn registry_creation_has_default_commands() {
    let registry = CommandRegistry::new();
    assert!(!registry.all().is_empty());
    assert!(registry.get("palette.open").is_some());
    assert!(registry.get("connections.new").is_some());
}

#[test]
fn command_definition_creation() {
    let cmd = CommandDefinition::new(
        "test.command",
        "Test Command",
        "A test command for testing",
        "Testing"
    );
    
    assert_eq!(cmd.id, "test.command");
    assert_eq!(cmd.name, "Test Command");
    assert_eq!(cmd.category, "Testing");
    assert!(cmd.shortcut.is_none());
}

#[test]
fn command_with_shortcut() {
    let cmd = CommandDefinition::new(
        "test.command",
        "Test Command",
        "A test command",
        "Testing"
    ).with_shortcut(vec!["Ctrl", "T"]);
    
    assert!(cmd.shortcut.is_some());
    assert_eq!(cmd.shortcut.as_ref().unwrap().display(), "Ctrl+T");
}

#[test]
fn shortcut_definition_display() {
    let shortcut = ShortcutDefinition::new(vec!["Ctrl", "Shift", "P"]);
    assert_eq!(shortcut.display(), "Ctrl+Shift+P");
}

#[test]
fn registry_register_and_get() {
    let mut registry = CommandRegistry::new();
    let cmd = CommandDefinition::new(
        "test.custom.cmd",
        "Custom Test",
        "A custom test command",
        "Testing"
    ).with_shortcut(vec!["Ctrl", "Alt", "T"]);
    
    registry.register(cmd);
    
    let found = registry.get("test.custom.cmd");
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, "test.custom.cmd");
}

#[test]
fn registry_find_by_shortcut() {
    let registry = CommandRegistry::new();
    
    let keys = vec!["Ctrl".to_string(), "P".to_string()];
    let found = registry.find_by_shortcut(&keys);
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, "palette.open");
}

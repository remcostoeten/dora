-- Migration 003: Keyboard Shortcuts
-- Stores custom keyboard shortcut bindings for commands

CREATE TABLE keyboard_shortcuts (
    command_id TEXT PRIMARY KEY,
    keys TEXT NOT NULL,  -- JSON array of key names, e.g., '["Ctrl", "N"]'
    enabled BOOLEAN DEFAULT TRUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_shortcuts_enabled ON keyboard_shortcuts(enabled);

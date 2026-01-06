-- Migration 006: Add snippet folders for organizing snippets

CREATE TABLE snippet_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    color TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES snippet_folders(id) ON DELETE CASCADE
);

-- Add folder_id to saved_queries for snippet organization
ALTER TABLE saved_queries ADD COLUMN folder_id INTEGER REFERENCES snippet_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_snippet_folders_parent ON snippet_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_folder ON saved_queries(folder_id);

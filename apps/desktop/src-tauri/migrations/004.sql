-- Migration 004: Add snippet support to saved_queries table
-- Add columns to differentiate between saved queries and snippets
-- Add column for syntax highlighting

ALTER TABLE saved_queries ADD COLUMN is_snippet BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE saved_queries ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE saved_queries ADD COLUMN language TEXT;

-- Index for faster snippet filtering
CREATE INDEX IF NOT EXISTS idx_saved_queries_is_snippet ON saved_queries(is_snippet);
CREATE INDEX IF NOT EXISTS idx_saved_queries_is_system ON saved_queries(is_system);

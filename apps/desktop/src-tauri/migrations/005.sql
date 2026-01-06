-- Migration 005: Add category field to saved_queries/snippets
-- Categories allow broader organization (e.g., "Query Templates, Dangerous")
-- Tags remain for fine-grained labels (e.g., "select,join,basic")

ALTER TABLE saved_queries ADD COLUMN category TEXT;

-- Index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_saved_queries_category ON saved_queries(category);

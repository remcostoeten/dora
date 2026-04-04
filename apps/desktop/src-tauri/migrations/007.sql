-- Migration 007: Add missing database types
-- The app uses numeric database_type_id values (including 3 for libsql) but 001.sql only seeded postgres/sqlite.
-- Add rows for libsql and mysql so joins and type decoding work.

INSERT OR IGNORE INTO database_types (id, name) VALUES
  (3, 'libsql'),
  (4, 'mysql');


CREATE TABLE IF NOT EXISTS schema_snapshots (
    connection_id TEXT PRIMARY KEY,
    schema_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

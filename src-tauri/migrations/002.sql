-- Migration 002: Connection History
-- Tracks connection attempts with success/fail status

CREATE TABLE connection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    database_type TEXT NOT NULL,
    attempted_at INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_conn_history_attempted ON connection_history(attempted_at DESC);
CREATE INDEX idx_conn_history_success ON connection_history(success);
CREATE INDEX idx_conn_history_db_type ON connection_history(database_type);

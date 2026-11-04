CREATE TABLE kv_connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    connection_data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_connected_at INTEGER,
    favorite BOOLEAN DEFAULT FALSE,
    color TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_kv_connections_favorite
    ON kv_connections(favorite);
CREATE INDEX idx_kv_connections_sort_order
    ON kv_connections(sort_order);
CREATE INDEX idx_kv_connections_last_connected
    ON kv_connections(last_connected_at DESC);

CREATE TABLE kv_command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id TEXT NOT NULL,
    command_text TEXT NOT NULL,
    executed_at INTEGER NOT NULL,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (connection_id) REFERENCES kv_connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_kv_command_history_connection
    ON kv_command_history(connection_id, executed_at DESC);

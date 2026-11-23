ALTER TABLE query_history ADD COLUMN origin TEXT NOT NULL DEFAULT 'user';
ALTER TABLE query_history ADD COLUMN agent_client TEXT;
ALTER TABLE query_history ADD COLUMN agent_proposal_id TEXT;
ALTER TABLE kv_command_history ADD COLUMN origin TEXT NOT NULL DEFAULT 'user';
ALTER TABLE kv_command_history ADD COLUMN agent_client TEXT;

CREATE TABLE agent_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

INSERT INTO agent_settings (id, enabled, updated_at)
VALUES (1, 0, CAST(strftime('%s', 'now') AS INTEGER));

CREATE TABLE agent_connection_grants (
    connection_id TEXT NOT NULL,
    connection_kind TEXT NOT NULL CHECK (connection_kind IN ('sql', 'kv')),
    permission TEXT NOT NULL CHECK (permission IN ('read', 'propose', 'read_write')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (connection_id, connection_kind)
);

CREATE TABLE agent_proposals (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    statements_json TEXT NOT NULL,
    statements_hash TEXT NOT NULL,
    summary TEXT NOT NULL,
    risk TEXT NOT NULL CHECK (risk IN ('standard', 'destructive')),
    status TEXT NOT NULL CHECK (
        status IN ('pending', 'approved', 'rejected', 'running', 'applied', 'failed', 'expired')
    ),
    agent_client TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    decided_at INTEGER,
    finished_at INTEGER,
    affected_rows INTEGER,
    error_message TEXT,
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_proposals_status
    ON agent_proposals(status, created_at DESC);
CREATE INDEX idx_agent_proposals_connection
    ON agent_proposals(connection_id, created_at DESC);
CREATE INDEX idx_query_history_origin
    ON query_history(origin, executed_at DESC);

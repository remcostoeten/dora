-- Migration 008: AI provider API key store
-- Stores user-managed API keys for AI providers (Groq today, others later).
-- Ciphertext is AES-256-GCM via security::encrypt; the encryption key lives in the OS keyring.
CREATE TABLE IF NOT EXISTS ai_api_keys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    provider     TEXT NOT NULL,
    label        TEXT NOT NULL,
    ciphertext   TEXT NOT NULL,
    is_active    INTEGER NOT NULL DEFAULT 1,
    last_tested  INTEGER,
    last_status  TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_provider ON ai_api_keys(provider, is_active);

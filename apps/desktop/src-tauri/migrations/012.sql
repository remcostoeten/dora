-- Migration 012: Add the PostHog database type.
-- PostHog is a new read-only engine (id 9) queried over the HogQL Query API.
-- Without this row the `database_types` LEFT JOIN in connection loading yields
-- NULL, COALESCE falls back to 'postgres', and a stored PostHog connection is
-- mis-decoded as Postgres.

INSERT OR IGNORE INTO database_types (id, name) VALUES
  (9, 'posthog');

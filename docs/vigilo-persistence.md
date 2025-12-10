# Persisting Vigilo tasks without an ORM

Vigilo is currently wired on the frontend only, so tasks live in memory. You can persist them in the existing Tauri SQLite store even without adding an ORM by following the same pattern used for connections, history, and scripts.

## Backend: use the raw SQLite layer
The Tauri backend already uses `rusqlite` directly (see `src-tauri/src/storage.rs`), so you can introduce a new table (e.g., `vigilo_tasks`) via a migration and read/write it with SQL statements. A minimal schema could look like:

```sql
CREATE TABLE IF NOT EXISTS vigilo_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo'
);
```

Add CRUD helpers alongside the existing methods in `Storage` to insert, update status, and list tasks by category. Because the project already executes SQL through `rusqlite` without an ORM, no new dependency is required.

## Frontend: invoke new Tauri commands
Expose the new storage helpers as Tauri commands and mirror them in `src/core/tauri/commands.ts`, similar to `saveScript` or `getQueryHistory`. From there, the Vigilo component can call `invoke` to load and persist tasks, keeping the UI synchronized with the database.

## Why this works without an ORM
All persistence in Dora already uses hand-written SQL (no ORM). Extending that approach to Vigilo simply means adding a table and commands; the existing `Storage` struct and migrations provide the necessary plumbing.

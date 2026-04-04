# Live Change Monitoring

Dora supports near-realtime table change monitoring in the desktop app.

## Current Behavior

- `PostgreSQL`: Dora installs a lightweight `LISTEN/NOTIFY` trigger for monitored tables and uses notifications to refresh visible table data quickly when external writes happen.
- `SQLite`: Dora keeps the existing polling-based monitor.
- `LibSQL / Turso`: Dora keeps the existing polling-based monitor.

## Scope

This feature is aimed at external database writes, for example:

- a web form inserting a row
- another admin tool updating records
- a background job deleting or modifying rows

Local writes triggered from Dora still go through the normal mutation/update path.

## Postgres Notes

- Notifications are used as a wake-up signal, not as the sole source of truth.
- Dora still re-reads table state after a notification so the UI reflects the real database state.
- Trigger installation is automatic when live monitoring starts for a Postgres table.

## Fallback Model

If Postgres notification setup fails for any reason, Dora falls back to interval polling instead of disabling monitoring entirely.

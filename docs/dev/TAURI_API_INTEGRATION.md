# Tauri Backend API Integration Guide

> Complete documentation of the Dora database application backend API for frontend integration.

## Overview

The Dora application is built with a **Tauri (Rust) backend** and **Next.js frontend**. The backend supports:

- **PostgreSQL** connections (via `tokio-postgres`)  
- **SQLite** connections (via `rusqlite`)

All commands are invoked via Tauri's `invoke()` IPC mechanism.

---

## Connection Management

### Tauri Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `test_connection` | `databaseInfo: DatabaseInfo` | `boolean` | Tests if a connection can be established |
| `add_connection` | `name: string, databaseInfo: DatabaseInfo, color?: number` | `ConnectionInfo` | Creates a new connection |
| `update_connection` | `connId: UUID, name: string, databaseInfo: DatabaseInfo, color?: number` | `ConnectionInfo` | Updates existing connection |
| `update_connection_color` | `connectionId: UUID, color?: number` | `void` | Updates only the color of a connection |
| `connect_to_database` | `connectionId: UUID` | `boolean` | Establishes active connection |
| `disconnect_from_database` | `connectionId: UUID` | `void` | Disconnects from database |
| `get_connections` | none | `ConnectionInfo[]` | Lists all saved connections |
| `remove_connection` | `connectionId: UUID` | `void` | Deletes a connection |
| `initialize_connections` | none | `void` | Loads connections from storage into memory |
| `get_connection_history` | `dbTypeFilter?: string, successFilter?: boolean, limit?: number` | `ConnectionHistoryEntry[]` | Gets connection attempt history |

### Connection Parameters

```typescript
// DatabaseInfo - Discriminated union by database type
type DatabaseInfo =
  | { Postgres: { connection_string: string } }
  | { SQLite: { db_path: string } }

// PostgreSQL connection string format:
// postgres://username:password@host:port/database?sslmode=require
// Note: 'channel_binding' parameter is stripped automatically

// SQLite connection:
// Just the absolute file path to the .db file
```

### ConnectionInfo Response

```typescript
type ConnectionInfo = {
  id: string                    // UUID
  name: string                  // User-friendly name
  connected: boolean            // Runtime connection state
  database_type: DatabaseInfo   // Connection parameters
  last_connected_at?: number    // Unix timestamp
  favorite?: boolean            // User preference
  color?: string                // Hue value as string
  sort_order?: number           // Display order
}
```

### Connection Lifecycle

1. **Password Storage**: Passwords are extracted from connection strings and stored securely in the system keyring (using OS-native credential storage)
2. **Connection Data Encryption**: Connection strings are AES-encrypted before storage in the local SQLite app database
3. **Connection Monitoring**: A background task polls active connections every 5 seconds and emits `end-of-connection` events on disconnect

### Connection Events

```typescript
// Listen for disconnect events on the frontend:
import { listen } from '@tauri-apps/api/event'

listen<string>('end-of-connection', (event) => {
  const connectionId = event.payload
  // Handle disconnect - connection was dropped by server
})
```

---

## Schema Introspection

### Command

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_database_schema` | `connectionId: UUID` | `DatabaseSchema` | Returns full schema metadata |

### Response Structure

```typescript
type DatabaseSchema = {
  tables: TableInfo[]      // All tables with columns
  schemas: string[]        // PostgreSQL schemas (empty for SQLite)
  unique_columns: string[] // Deduplicated column names for autocomplete
}

type TableInfo = {
  name: string             // Table name
  schema: string           // Schema name (e.g., 'public') - empty for SQLite
  columns: ColumnInfo[]    // Column definitions
}

type ColumnInfo = {
  name: string             // Column name
  data_type: string        // Native type (e.g., 'integer', 'varchar', 'TEXT')
  is_nullable: boolean     // Whether NULL is allowed
  default_value: string | null  // Default expression if set
}
```

### Implementation Details

**PostgreSQL Schema Query:**
```sql
SELECT 
  t.table_schema,
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable::boolean,
  c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
WHERE t.table_type = 'BASE TABLE'
  AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY t.table_schema, t.table_name, c.ordinal_position
```

**SQLite Schema Query:**
```sql
SELECT name FROM sqlite_master 
WHERE type='table' AND name NOT LIKE 'sqlite_%'

-- Then for each table:
PRAGMA table_info('table_name')
```

### Current Limitations

- **No foreign key relationships** in response (could be added)
- **No index information** (could be added)
- **No enum/check constraint values** extracted
- **No primary key detection** in response

---

## Query Execution

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `start_query` | `connectionId: UUID, query: string` | `QueryId[]` | Starts executing one or more statements |
| `fetch_query` | `queryId: number` | `StatementInfo` | Gets execution status and first page |
| `fetch_page` | `queryId: number, pageIndex: number` | `Page \| null` | Fetches a specific results page |
| `get_query_status` | `queryId: number` | `QueryStatus` | Gets current execution status |
| `get_page_count` | `queryId: number` | `number` | Gets total number of pages available |
| `get_columns` | `queryId: number` | `string[] \| null` | Gets column names for results |

### Query Types

```typescript
type QueryId = number  // Index into statement array

type QueryStatus = 'Pending' | 'Running' | 'Completed' | 'Error'

type StatementInfo = {
  returns_values: boolean     // true for SELECT, false for UPDATE/INSERT/DELETE
  status: QueryStatus         // Current execution state
  first_page: Page | null     // First page of results if available
  affected_rows: number | null  // For mutations
  error: string | null        // Error message if failed
}

// Page is a 2D JSON array: rows × columns
type Page = Json[][]
type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
```

### Pagination Model

- Results are streamed in **pages** (not traditional LIMIT/OFFSET)
- Each page contains multiple rows (batch size determined by backend)
- Pages are stored in memory and can be fetched by index
- **No native query cancellation** currently implemented

### Multi-Statement Execution

When a query contains multiple SQL statements (separated by semicolons):

```typescript
const queryIds = await startQuery(connectionId, `
  SELECT 1;
  SELECT 2;
  UPDATE users SET name = 'test' WHERE id = 1;
`)
// Returns: [0, 1, 2] - one QueryId per statement
```

### Data Type Serialization

All data is serialized as JSON. Special handling:

| PostgreSQL Type | JSON Output |
|-----------------|-------------|
| `integer`, `bigint` | number |
| `numeric`, `decimal` | string (preserves precision) |
| `boolean` | boolean |
| `json`, `jsonb` | object/array |
| `timestamp`, `date`, `time` | string (ISO format) |
| `uuid` | string |
| `bytea` | base64 string |
| `array` | JSON array |
| `NULL` | null |

---

## Data Mutations

### Current Status

> **No dedicated mutation commands exist.** All mutations use `start_query` with raw SQL.

```typescript
// INSERT
await startQuery(connectionId, `
  INSERT INTO users (name, email) VALUES ('John', 'john@example.com')
`)

// UPDATE  
await startQuery(connectionId, `
  UPDATE users SET name = 'Jane' WHERE id = 1
`)

// DELETE
await startQuery(connectionId, `
  DELETE FROM users WHERE id = 1
`)
```

### Transaction Support

Transactions must be handled via raw SQL:

```typescript
await startQuery(connectionId, `
  BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
  COMMIT;
`)
```

### Rollback

```typescript
await startQuery(connectionId, `ROLLBACK`)
```

### Batch Updates

Not natively supported. Execute as multi-statement query or within a transaction.

---

## Validation

### Server-Side Validation

There is **no built-in server-side validation** before mutations. The backend executes SQL directly.

### Constraint Violations

Database constraint violations return errors via `StatementInfo.error`:

```typescript
const [queryId] = await startQuery(connectionId, `
  INSERT INTO users (email) VALUES ('duplicate@example.com')
`)
const result = await fetchQuery(queryId)

if (result.status === 'Error') {
  console.log(result.error)
  // Example: "duplicate key value violates unique constraint \"users_email_key\""
}
```

### Error Format

```typescript
// Errors are returned as serialized JSON:
{
  "name": "error",
  "message": "error description from database driver"
}
```

---

## Real-time Updates

### Current Implementation

There is **no database change listening** (no LISTEN/NOTIFY, no CDC).

### Available Mechanism

The only real-time feature is **connection health monitoring**:

```typescript
// Tauri event emitted when connection drops
listen('end-of-connection', (event) => {
  // event.payload is the connection UUID
})
```

### Future Considerations

For real-time updates, potential approaches:
- PostgreSQL: LISTEN/NOTIFY with async polling
- Tauri events for frontend notification
- Manual refresh triggers

---

## Session & Settings Management

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `save_session_state` | `sessionData: string` | `void` | Persists UI session state |
| `get_session_state` | none | `string \| null` | Retrieves saved session |
| `set_setting` | `key: string, value: string` | `void` | Saves app setting |
| `get_setting` | `key: string` | `string \| null` | Retrieves app setting |

### Usage

```typescript
// Save complex state as JSON
await setSetting('theme', JSON.stringify({ mode: 'dark', accent: 'blue' }))

// Retrieve and parse
const theme = await getSetting<{ mode: string, accent: string }>('theme')
```

---

## Query History

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `save_query_to_history` | `connectionId, query, durationMs?, status, rowCount, errorMessage?` | `void` | Records executed query |
| `get_query_history` | `connectionId: string, limit?: number` | `QueryHistoryEntry[]` | Retrieves query history |

### QueryHistoryEntry

```typescript
type QueryHistoryEntry = {
  id: number
  connection_id: string
  query_text: string
  executed_at: number      // Unix timestamp
  duration_ms: number | null
  status: string           // 'success', 'error', etc.
  row_count: number
  error_message: string | null
}
```

---

## Script Management

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `save_script` | `name, content, connectionId?, description?` | `number` | Saves new script, returns ID |
| `update_script` | `id, name, content, connectionId?, description?` | `void` | Updates existing script |
| `get_scripts` | `connectionId?: UUID` | `Script[]` | Lists scripts |
| `delete_script` | `id: number` | `void` | Deletes a script |

### Script Type

```typescript
type Script = {
  id: number
  name: string
  description: string | null
  query_text: string
  connection_id: string | null  // Associated connection
  tags: string | null           // Comma-separated tags
  created_at: number            // Unix timestamp
  updated_at: number
  favorite?: boolean
}
```

---

## Window Controls

### Commands

| Command | Returns | Description |
|---------|---------|-------------|
| `minimize_window` | `void` | Minimizes app window |
| `maximize_window` | `void` | Toggles maximize state |
| `close_window` | `void` | Closes the window |
| `open_sqlite_db` | `string \| null` | Opens file picker for SQLite |
| `save_sqlite_db` | `string \| null` | Opens save dialog for SQLite |

---

## Commands System (Keyboard Shortcuts)

### Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `get_all_commands` | none | `Command[]` | Lists all available commands |
| `get_command` | `commandId: string` | `Command \| null` | Gets specific command |
| `update_command_shortcut` | `commandId: string, shortcut: string` | `void` | Updates keyboard binding |
| `get_custom_shortcuts` | none | `{ [id: string]: string }` | Gets user customizations |

---

## Internal Architecture

### State Management

```rust
pub struct AppState {
    // In-memory connection pool
    pub connections: DashMap<Uuid, DatabaseConnection>,
    
    // Cached schemas
    pub schemas: DashMap<Uuid, Arc<DatabaseSchema>>,
    
    // Local SQLite database for app data
    pub storage: Storage,
    
    // Manages query execution workers
    pub stmt_manager: StatementManager,
    
    // Keyboard shortcuts registry
    pub command_registry: RwLock<CommandRegistry>,
}
```

### Query Execution Flow

```
1. start_query called
2. SQL parsed into individual statements
3. For each statement:
   a. Worker thread created
   b. Query executed on database connection
   c. Results streamed as pages via mpsc channel
   d. Pages stored in StatementManager
4. Frontend polls with fetch_query / fetch_page
```

### Storage

Application data is stored in a local SQLite database at:
- **Linux**: `~/.local/share/Dora/Dora.db`
- **macOS**: `~/Library/Application Support/Dora/Dora.db`
- **Windows**: `%APPDATA%\Dora\Dora.db`

Tables:
- `connections` - Saved database connections (encrypted)
- `database_types` - Reference table (1: postgres, 2: sqlite)
- `query_history` - Executed query log
- `saved_queries` - User's saved scripts
- `connection_history` - Connection attempt log
- `app_settings` - Key-value settings

---

## TypeScript Integration

### Existing Frontend Types

Located in `/src/types/database.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core'

// Main command wrapper pattern:
export async function startQuery(connectionId: string, query: string): Promise<QueryId[]> {
  return await invoke('start_query', { connectionId, query })
}
```

### isTauri Detection

```typescript
// Check if running in Tauri context
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}
```

---

## Error Handling Patterns

### Backend Error Types

```rust
pub enum Error {
    Any(anyhow::Error),      // Generic errors
    Tauri(tauri::Error),     // Tauri-specific
    Rusqlite(rusqlite::Error), // SQLite errors
    Fmt(std::fmt::Error),
    Json(serde_json::Error),
}
```

### Frontend Handling

```typescript
try {
  const result = await connectToDatabase(connectionId)
} catch (error) {
  // Error format: { name: "error", message: "description" }
  const errorMessage = (error as { message: string }).message
}
```

---

## Migration Notes

### Features NOT Currently Supported

1. **LibSQL connections** - Only PostgreSQL and SQLite
2. **Query cancellation** - Must wait for completion
3. **Connection pooling** - Single connection per entry
4. **Foreign key introspection** - Not returned in schema
5. **Enum/check constraint values** - Not extracted
6. **Real-time change notifications** - No CDC/LISTEN support
7. **Batch/bulk mutations API** - Use raw SQL
8. **Optimistic updates** - Must be frontend-only

### Adding New Database Types

To add LibSQL or other databases:

1. Create new module under `src-tauri/src/database/libsql/`
2. Implement `execute.rs`, `schema.rs`, `parser.rs`
3. Add variant to `DatabaseInfo`, `Database`, `DatabaseClient` enums
4. Update connection commands to handle new type

---

## Complete Command Reference

### Database Commands
- `test_connection`
- `add_connection`
- `update_connection`
- `update_connection_color`
- `connect_to_database`
- `disconnect_from_database`
- `start_query`
- `fetch_query`
- `fetch_page`
- `get_query_status`
- `get_page_count`
- `get_columns`
- `get_connections`
- `remove_connection`
- `initialize_connections`
- `save_query_to_history`
- `get_query_history`
- `get_database_schema`
- `save_script`
- `update_script`
- `get_scripts`
- `delete_script`
- `save_session_state`
- `get_session_state`
- `get_setting`
- `set_setting`
- `get_connection_history`

### Window Commands
- `minimize_window`
- `maximize_window`
- `close_window`
- `open_sqlite_db`
- `save_sqlite_db`

### Commands System
- `get_all_commands`
- `get_command`
- `update_command_shortcut`
- `get_custom_shortcuts`

### Test/Development
- `populate_test_queries_command`

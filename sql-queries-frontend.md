# SQL Queries and Mutations in Frontend Code

This document contains all SQL queries and database operations found in the frontend TypeScript code.

## SQL Queries Found

### 1. Table Data Query
**File:** `src/app/page.tsx`  
**Line:** 284  
**SQL Statement:**
```sql
SELECT * FROM ${schema ? `"${schema}".` : ''}"${tableName}" LIMIT 100;
```
**Context:** Generated when user clicks on a table in the schema browser to fetch the first 100 rows

### 2. Dynamic Query Execution
**File:** `src/app/page.tsx`  
**Line:** 333  
**SQL Statement:** (Dynamic - from editor content)
```typescript
const results = await executeQuery(selectedConnection, currentEditorContent)
```
**Context:** Executes user-written SQL queries from the SQL editor

## Database Operation Functions

### Query Execution Infrastructure
**File:** `src/lib/tauri-commands.ts`  
**Lines:** 156-193

#### Start Query Function
**Line:** 156
```typescript
export async function startQuery(connectionId: string, query: string): Promise<QueryId[]> {
  return await invoke('start_query', { connectionId, query })
}
```

#### Execute Query Function
**Line:** 180
```typescript
export async function executeQuery(
  connectionId: string,
  query: string
): Promise<StatementInfo[]> {
  const queryIds = await startQuery(connectionId, query)
  const results: StatementInfo[] = []
  
  for (const queryId of queryIds) {
    const result = await fetchQuery(queryId)
    results.push(result)
  }
  
  return results
}
```

### Query History Operations
**File:** `src/lib/tauri-commands.ts`  
**Lines:** 53-69

#### Save Query to History
**Line:** 53
```typescript
export async function saveQueryToHistory(
  connectionId: string,
  query: string,
  durationMs?: number,
  status: string = 'success',
  rowCount: number = 0,
  errorMessage?: string
): Promise<void> {
  await invoke('save_query_to_history', {
    connectionId,
    query,
    durationMs,
    status,
    rowCount,
    errorMessage,
  })
}
```

### Script Storage Operations
**File:** `src/lib/tauri-commands.ts`  
**Lines:** 90-102

#### Save Script
**Line:** 90
```typescript
export async function saveScript(
  connectionId: string,
  name: string,
  content: string,
  folderId?: string
): Promise<void> {
  await invoke('save_script', {
    connectionId,
    name,
    content,
    folderId,
  })
}
```

## SQL Language Support
**File:** `src/components/sql-editor.tsx`  
**Line:** 52  
**Context:** SQL syntax highlighting configuration
```typescript
sql(),
```

## Summary

- **Total hardcoded SQL queries:** 1 (SELECT statement for table browsing)
- **Dynamic query execution:** 1 (user input from SQL editor)
- **Database operation wrappers:** 4 functions for query execution, history, and script management
- **SQL language support:** 1 configuration for syntax highlighting

The frontend follows a clean architecture where:
1. Only one hardcoded SQL query exists (for table data browsing)
2. All other SQL operations are dynamic user input
3. Database operations are handled through Tauri backend invocations
4. No direct INSERT/UPDATE/DELETE/CREATE statements are hardcoded in the frontend
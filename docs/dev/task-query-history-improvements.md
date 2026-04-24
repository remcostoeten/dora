# Task: Query History Improvements

**Complexity:** Medium  
**Recommended agent:** Claude Sonnet 4.6 (1 agent)  
**Branch:** `feat/query-history-improvements`  
**Estimated time:** 2–3 hours  

---

## Context

The SQL Console has a query history panel. Current state is functional but minimal:
- `apps/desktop/src/features/sql-console/stores/query-history-store.tsx` — Context + localStorage, max 50 items
- `apps/desktop/src/features/sql-console/components/query-history-panel.tsx` — renders list, click to load query

`QueryHistoryItem` type:
```ts
type QueryHistoryItem = {
  id: string
  query: string
  connectionId: string | null
  timestamp: number
  executionTimeMs: number
  success: boolean
  error?: string
  rowCount?: number
}
```

Missing features: search, pin, group-by-connection.

---

## What to build

### 1. Pin queries

Add `pinned: boolean` field to `QueryHistoryItem`. Pinned items:
- Appear at top of the list in a "Pinned" section, separated from regular history
- Are NOT evicted when `maxItems` (50) is exceeded — only unpinned items rotate
- Persist in localStorage with the rest of history

**Store changes** (`query-history-store.tsx`):
- Add `pinItem(id: string)` and `unpinItem(id: string)` to context value
- `addToHistory`: when trimming to `MAX_HISTORY_ITEMS`, `filter(item => !item.pinned)` first, then slice, then re-add pinned

**Panel changes** (`query-history-panel.tsx`):
- Add pin icon button (use `Pin` from lucide-react) next to the trash icon, visible on group hover
- Split render: pinned section first (with header "Pinned"), then regular history

### 2. Search / filter

Add a search input at the top of the panel (inside the header bar, below the title row).

- Filter applies to `item.query` with case-insensitive `includes()`
- Also match `item.error` if present
- Show match count: `3 / 12 results` in muted text next to input
- When search is empty, show all (existing behaviour)
- Input has an `×` clear button when non-empty

**No store changes needed** — filter is pure local state in the panel component.

### 3. Group by connection

Add a toggle button in the panel header (icon: `Layers` from lucide-react). When active:

- Group history items by `connectionId`
- Each group has a collapsible header showing the connection name
- Connection name: look up from `currentConnectionId` prop context — you'll need to pass `connections: Connection[]` as a prop to the panel, or use a prop `connectionName: (id: string) => string`
- Items with `connectionId === null` go into an "Unknown" group
- Collapsed state is local component state (not persisted)

**Panel prop addition:**
```ts
type Props = {
  onSelectQuery: (query: string) => void
  currentConnectionId?: string
  getConnectionName?: (id: string) => string  // add this
}
```

In `sql-console.tsx` where `QueryHistoryPanel` is rendered, pass:
```tsx
getConnectionName={(id) => connections.find(c => c.id === id)?.name ?? id.slice(0, 8)}
```

Find the render site: `apps/desktop/src/features/sql-console/sql-console.tsx` — search for `<QueryHistoryPanel`.

### 4. Increase max items + export

- Bump `MAX_HISTORY_ITEMS` from 50 → 200
- Add an "Export" button in the panel header (icon: `Download`) that downloads history as JSON:
  ```ts
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  // <a download="query-history.json" href={url}> click trigger
  ```

---

## File list

| File | Change |
|------|--------|
| `stores/query-history-store.tsx` | Add `pinned` field, `pinItem`/`unpinItem`, fix eviction logic |
| `components/query-history-panel.tsx` | Search input, pin button, group-by toggle, export button |
| `sql-console.tsx` | Pass `getConnectionName` prop |

## TypeScript check

```bash
cd apps/desktop
~/.bun/bin/bun x tsc --noEmit -p tsconfig.app.json
# must exit 0
```

## Done when

- Pin persists across reload
- Search filters the list live
- Group-by-connection toggle works and shows connection names
- Export downloads valid JSON
- `tsc --noEmit` exits 0
- No console errors on normal usage

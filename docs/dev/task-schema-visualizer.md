# Task: Schema Visualizer

**Complexity:** High  
**Recommended agent:** Claude Opus 4.7  
**Branch:** `feat/schema-visualizer`  
**Estimated time:** 1–2 days  

---

## Context

Dora is a Tauri 2.x desktop database client (Rust backend, React/TypeScript frontend). The schema visualizer is a new top-level view showing an interactive ER diagram — tables as nodes, foreign keys as edges.

**The backend already provides everything needed.** No Rust changes required.

### Existing backend API

Command: `get_database_schema(connectionId: string)` → `DatabaseSchema`

Types (already in `apps/desktop/src/lib/bindings.ts`):
```ts
type DatabaseSchema = {
  tables: TableInfo[]
  schemas: string[]
  unique_columns: string[]
}

type TableInfo = {
  name: string
  schema: string
  columns: ColumnInfo[]
  primary_key_columns: string[]
  indexes: IndexInfo[]
  row_count_estimate: number | null
}

type ColumnInfo = {
  name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
  is_primary_key: boolean
  is_auto_increment: boolean
  foreign_key: ForeignKeyInfo | null
}

type ForeignKeyInfo = {
  referenced_table: string
  referenced_column: string
  referenced_schema: string
}
```

Frontend adapter method: `adapter.getSchema(connectionId)` — defined in `apps/desktop/src/core/data-provider/adapters/tauri.ts:112`

### Navigation integration

The app's nav is in `apps/desktop/src/features/app-sidebar/navigation-sidebar.tsx`. Nav items are objects with `id`, `label`, `icon`. The active view is `activeNavId` state in `apps/desktop/src/pages/Index.tsx`.

The main content render switch is at `Index.tsx:611` — add a new `activeNavId === 'schema-visualizer'` branch.

---

## What to build

### 1. Install dependencies

```bash
cd apps/desktop
bun add @xyflow/react
```

`@xyflow/react` (React Flow v12) is the standard choice — maintained, MIT, supports custom nodes, handles pan/zoom/minimap.

> Do NOT install `dagre` or `elkjs` for layout — implement a simple grid layout manually (see Step 3). External layout engines add complexity and bundle weight without meaningful benefit for ≤100 tables.

### 2. New feature directory

Create `apps/desktop/src/features/schema-visualizer/` with:

```
schema-visualizer/
  index.ts                    # re-export SchemaVisualizer
  schema-visualizer.tsx       # top-level component (data fetching + ReactFlow canvas)
  components/
    table-node.tsx            # custom node: table card with columns list
    relationship-edge.tsx     # custom edge: labeled FK arrow
    schema-toolbar.tsx        # search, fit-view, minimap toggle, export PNG
  hooks/
    use-schema-graph.ts       # transforms DatabaseSchema → nodes + edges
```

### 3. Data transformation (`use-schema-graph.ts`)

Input: `DatabaseSchema`  
Output: `{ nodes: Node[], edges: Edge[] }` for React Flow

**Nodes** — one per table:
```ts
type TableNodeData = {
  tableName: string
  schema: string
  columns: ColumnInfo[]
  primaryKeyColumns: string[]
  rowCountEstimate: number | null
}
```

**Edges** — one per foreign key:
- Source: `${fromTable}__${fromColumn}` handle
- Target: `${toTable}__${toColumn}` handle  
- Label: `fk` or the column name
- `type: 'smoothstep'` (built-in React Flow edge type, no custom component needed)

**Layout algorithm** — simple grid, no external lib:
```ts
const COLS = Math.ceil(Math.sqrt(tables.length))
const H_GAP = 320   // px between columns
const V_GAP = 40 + maxColumnsPerTable * 24  // dynamic row height
tables.forEach((table, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  positions[table.name] = { x: col * H_GAP, y: row * V_GAP }
})
```

Positions are initial only — React Flow handles dragging after render.

### 4. Table node component (`table-node.tsx`)

Custom React Flow node. Shows:
- Header: table name (bold) + schema name (muted, smaller) + row count estimate
- Column list: each row = `[PK icon] column_name  data_type  [FK icon]`
  - PK icon: `Key` from lucide-react, shown if `is_primary_key`
  - FK icon: `Link` from lucide-react, shown if `foreign_key !== null`
  - Nullable columns: `data_type` in muted color
- React Flow source/target handles on each column row (not just the node border) — one `<Handle>` per column with id `${tableName}__${columnName}`

Style: match existing app theme — use CSS variables (`var(--sidebar)`, `var(--sidebar-border)`, `var(--sidebar-foreground)`, `var(--primary)`) not hardcoded colors.

Width: fixed `280px`. Height: auto based on column count.

### 5. Main component (`schema-visualizer.tsx`)

```tsx
'use client'  // not needed for Tauri but harmless

import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
```

Responsibilities:
1. Call `adapter.getSchema(activeConnectionId)` on mount and when `activeConnectionId` changes
2. Transform result via `useSchemaGraph`
3. Render `<ReactFlow>` with:
   - `nodeTypes={{ tableNode: TableNode }}`
   - `<Background variant="dots" />`
   - `<Controls />`
   - `<MiniMap />` (toggleable via toolbar)
4. Show loading spinner while fetching
5. Show empty state if no connection or no tables

Props:
```ts
type Props = {
  activeConnectionId: string | undefined
}
```

### 6. Toolbar (`schema-toolbar.tsx`)

Horizontal bar above the canvas:
- **Search box**: filters visible nodes by table name (hide non-matching nodes, keep their edges — or alternatively highlight matching nodes)
- **Fit view button**: calls React Flow's `fitView()` via `useReactFlow()` hook
- **Minimap toggle**: local boolean state, passed as prop to main component
- **Export PNG button**: React Flow has built-in `getViewport()` — use `html2canvas` or the simpler approach of `toBlob` on the React Flow wrapper div. **Simpler alternative:** just download the current JSON schema as a file — skip PNG export if it adds complexity.
- **Table count badge**: `{tables.length} tables • {edges.length} relationships`

### 7. Wire into navigation

**`apps/desktop/src/features/app-sidebar/navigation-sidebar.tsx`**  
Add nav item. Find the array of nav items (look for objects with `id: 'database-studio'`):
```ts
{
  id: 'schema-visualizer',
  label: 'Schema',
  icon: <Network className="h-4 w-4" />,  // lucide-react
}
```

**`apps/desktop/src/pages/Index.tsx`**  
Add lazy import:
```ts
const SchemaVisualizer = lazy(() =>
  import('@/features/schema-visualizer').then(m => ({ default: m.SchemaVisualizer }))
)
```

Add branch in the render switch (around line 635, after the `sql-console` branch):
```tsx
) : activeNavId === 'schema-visualizer' ? (
  <ErrorBoundary feature="Schema Visualizer">
    <SchemaVisualizer activeConnectionId={activeConnectionId} />
  </ErrorBoundary>
) : activeNavId === 'docker' ? (
```

### 8. CSS isolation

React Flow ships its own stylesheet. Import it inside `schema-visualizer.tsx`:
```ts
import '@xyflow/react/dist/style.css'
```

Override the React Flow background/node colors to match app theme via CSS variables — do NOT patch `node_modules`. Add overrides to `apps/desktop/src/index.css` under a `.schema-visualizer` wrapper class applied to the outer div:
```css
.schema-visualizer .react-flow__background {
  background-color: var(--background);
}
.schema-visualizer .react-flow__minimap {
  background-color: var(--sidebar);
}
```

---

## File list

| File | Action |
|------|--------|
| `apps/desktop/package.json` | Add `@xyflow/react` |
| `src/features/schema-visualizer/index.ts` | New — re-export |
| `src/features/schema-visualizer/schema-visualizer.tsx` | New — main component |
| `src/features/schema-visualizer/components/table-node.tsx` | New — custom node |
| `src/features/schema-visualizer/components/schema-toolbar.tsx` | New — toolbar |
| `src/features/schema-visualizer/hooks/use-schema-graph.ts` | New — transform hook |
| `src/features/app-sidebar/navigation-sidebar.tsx` | Add nav item |
| `src/pages/Index.tsx` | Add lazy import + render branch |
| `src/index.css` | Add theme overrides for React Flow |

---

## Constraints

- No backend changes
- No Rust/Cargo changes
- Do not use `dagre`, `elkjs`, or `d3` — grid layout only
- Must work with all 4 driver types (Postgres, MySQL, SQLite, LibSQL) — the schema API is uniform
- TypeScript strict: `tsc --noEmit` must exit 0 after changes
- Do not import from `@/features/database-studio` — the two features are independent

## TypeScript check

```bash
cd apps/desktop
~/.bun/bin/bun x tsc --noEmit -p tsconfig.app.json
# must exit 0
```

## Done when

- Schema Visualizer nav item appears in sidebar
- Clicking it shows the ER diagram for the active connection
- Tables render as draggable cards with column details
- FK relationships draw as edges between tables
- Fit-view, minimap, search work
- No TypeScript errors
- Switching connections refreshes the diagram
- Loading and empty states handled

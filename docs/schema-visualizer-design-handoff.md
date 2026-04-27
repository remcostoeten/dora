# Schema visualizer design handoff

This document gives another design agent everything needed to redesign or
rebuild the schema visualizer with dummy data. You can use it without running
the backend. It covers the file map, the current UI structure, the important
data shapes, the mounted entry point, and a drop-in mock dataset.

## What this feature is

The schema visualizer is an ER-diagram-style screen inside the desktop app. It
shows database tables as draggable cards, foreign key relationships as edges,
and a right-side inspector for the selected table.

The feature is currently built with React Flow (`@xyflow/react`) and is mounted
inside the main desktop view switch in `apps/desktop/src/pages/Index.tsx`.

## Files involved

These are the files that matter for the schema visualizer.

### Core feature files

- `apps/desktop/src/features/schema-visualizer/index.ts`
- `apps/desktop/src/features/schema-visualizer/schema-visualizer.tsx`
- `apps/desktop/src/features/schema-visualizer/hooks/use-schema-graph.ts`

### UI components

- `apps/desktop/src/features/schema-visualizer/components/schema-toolbar.tsx`
- `apps/desktop/src/features/schema-visualizer/components/schema-details-panel.tsx`
- `apps/desktop/src/features/schema-visualizer/components/table-node.tsx`
- `apps/desktop/src/features/schema-visualizer/components/relationship-edge.tsx`

### Feature styles

- `apps/desktop/src/index.css`

The schema visualizer styles are the blocks that start with
`.schema-visualizer`, `.sv-`, and React Flow overrides under that namespace.

### Mount point

- `apps/desktop/src/pages/Index.tsx`

This file lazy-loads the feature and renders it when `activeNavId` is
`schema-visualizer`.

### Related but currently unused

- `apps/desktop/src/features/schema-visualizer/components/schema-overview-panel.tsx`

This file exists, but it is not mounted anymore. You can ignore it unless you
want to reuse parts of it.

## Current screen structure

The current screen is composed from a small number of modules. If you want to
replace the design while keeping behavior intact, these are the seams to work
with.

### `schema-visualizer.tsx`

This is the top-level module. It owns:

- schema fetching through `adapter.getSchema(activeConnectionId)`
- loading and empty states
- search state
- minimap toggle state
- edit mode toggle state
- selected table state
- SQL source state for the inspector
- React Flow node and edge state
- export actions for JSON, SVG, PNG, SQL, and Drizzle

It renders:

1. `SchemaToolbar`
2. `ReactFlow`
3. `SchemaDetailsPanel` when a table is selected

### `use-schema-graph.ts`

This module transforms `DatabaseSchema` into React Flow nodes and edges. It
also computes search highlighting and relationship metadata.

This is the most important logic file if a redesign wants to keep the same
behavior but swap the presentation.

### `schema-toolbar.tsx`

This component renders the top toolbar. It currently contains:

- a search input
- search suggestions
- a count summary
- fit-view action
- edit-mode toggle
- minimap toggle
- export menu
- refresh action

### `table-node.tsx`

This is the custom React Flow node for a table card. It renders:

- table name
- schema label
- column count
- match badge
- one row per column
- per-column source and target handles
- PK, FK, or generic role badges
- data type labels

### `relationship-edge.tsx`

This is the custom React Flow edge. It renders:

- relationship line
- different visuals for `1:N`, `1:1`, and `N:M`
- optional animated flow accent
- selected edge label with source and target column names

### `schema-details-panel.tsx`

This is the right-side inspector. It currently renders:

- selected table header
- stats cards
- open-table action
- SQL and Drizzle export/copy actions
- tabs for `Overview`, `Columns`, and `Code`
- column list
- column tips and warnings

## Current data contracts

The feature consumes backend schema data from
`apps/desktop/src/lib/bindings.ts`. These are the important types.

### Schema input shape

`DatabaseSchema`:

```ts
type DatabaseSchema = {
  tables: TableInfo[]
  schemas: string[]
  unique_columns: string[]
}
```

`TableInfo`:

```ts
type TableInfo = {
  name: string
  schema: string
  columns: ColumnInfo[]
  primary_key_columns?: string[]
  indexes?: IndexInfo[]
  row_count_estimate?: number | null
}
```

`ColumnInfo`:

```ts
type ColumnInfo = {
  name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
  is_primary_key?: boolean
  is_auto_increment?: boolean
  foreign_key?: ForeignKeyInfo | null
}
```

`ForeignKeyInfo`:

```ts
type ForeignKeyInfo = {
  referenced_table: string
  referenced_column: string
  referenced_schema: string
}
```

`IndexInfo`:

```ts
type IndexInfo = {
  name: string
  column_names: string[]
  is_unique: boolean
  is_primary: boolean
}
```

### Graph-level view model

`use-schema-graph.ts` creates a second layer of UI-oriented types.

`TableNodeData`:

```ts
type TableNodeData = {
  tableId: string
  tableName: string
  schema: string
  columns: ColumnInfo[]
  primaryKeyColumns: string[]
  indexes: IndexInfo[]
  rowCountEstimate: number | null
  searchState: 'default' | 'match' | 'context' | 'dim'
  matchedColumns: string[]
}
```

`RelationshipEdgeData`:

```ts
type RelationshipEdgeData = {
  cardinality: '1:N' | '1:1' | 'N:M'
  descriptor: string
  sourceColumn: string
  targetColumn: string
  sourceTableName: string
  targetTableName: string
  relationKind: 'one-to-many' | 'one-to-one' | 'many-to-many'
  viaTable?: string
  isOptional: boolean
  isSelfReference: boolean
  searchState: 'default' | 'match' | 'context' | 'dim'
}
```

## Interaction model

The redesign should preserve these behaviors unless you intentionally want to
change them.

### Selection and focus

The user can click a table node to open the details panel. Clicking the empty
canvas clears the selected table.

### Search behavior

Search is not only visual filtering. It also drives semantic highlighting.

- matching tables become `match`
- directly related tables become `context`
- everything else becomes `dim`
- matching columns are tracked separately in `matchedColumns`

The search parser supports free text and advanced tokens:

- `table:users`
- `schema:public`
- `column:email`
- `type:uuid`
- `pk`
- `fk`
- `nullable`
- `index`
- `noindex`

### Layout behavior

The initial graph layout is a simple computed grid. After render, node
positions can be dragged and are saved to `localStorage` per connection.

### Export behavior

The top-level module currently supports:

- JSON export of the raw schema
- SVG export of the diagram
- PNG export of the diagram
- SQL export from `adapter.getDatabaseDDL`
- Drizzle export via `convertSchemaToDrizzle`

If the redesign is purely visual, you can ignore the export details at first
and keep those actions as placeholder buttons.

## Visual dependencies and styling

The current implementation is not self-contained in a component stylesheet. It
depends on global selectors in `apps/desktop/src/index.css`.

Important style namespaces:

- `.schema-visualizer`
- `.schema-visualizer__canvas`
- `.sv-toolbar*`
- `.sv-table-node*`
- `.sv-handle*`
- `.sv-edge-*`
- `.sv-details-panel*`

If another design agent wants to rebuild the screen cleanly, the safest path is
to keep the data logic and replace the CSS and markup in:

- `schema-toolbar.tsx`
- `table-node.tsx`
- `schema-details-panel.tsx`
- the schema-visualizer CSS section in `index.css`

## Dummy data recipe

You do not need the backend to redesign this screen. The fastest path is to
hardcode a `DatabaseSchema` object and pass it through `useSchemaGraph`.

Use this mock object as a starting point.

```ts
const mockSchema: DatabaseSchema = {
  schemas: ['public', 'auth', 'billing'],
  unique_columns: [
    'id',
    'users.id',
    'public.users.id',
    'profiles.user_id',
    'billing.customers.stripe_customer_id',
  ],
  tables: [
    {
      name: 'users',
      schema: 'public',
      row_count_estimate: 1240,
      primary_key_columns: ['id'],
      indexes: [
        {
          name: 'users_pkey',
          column_names: ['id'],
          is_unique: true,
          is_primary: true,
        },
        {
          name: 'users_email_key',
          column_names: ['email'],
          is_unique: true,
          is_primary: false,
        },
      ],
      columns: [
        {
          name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: 'gen_random_uuid()',
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: null,
        },
        {
          name: 'email',
          data_type: 'text',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
        {
          name: 'created_at',
          data_type: 'timestamp',
          is_nullable: false,
          default_value: 'now()',
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
      ],
    },
    {
      name: 'profiles',
      schema: 'public',
      row_count_estimate: 1180,
      primary_key_columns: ['id'],
      indexes: [
        {
          name: 'profiles_pkey',
          column_names: ['id'],
          is_unique: true,
          is_primary: true,
        },
        {
          name: 'profiles_user_id_key',
          column_names: ['user_id'],
          is_unique: true,
          is_primary: false,
        },
      ],
      columns: [
        {
          name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: 'gen_random_uuid()',
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: null,
        },
        {
          name: 'user_id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: {
            referenced_table: 'users',
            referenced_column: 'id',
            referenced_schema: 'public',
          },
        },
        {
          name: 'display_name',
          data_type: 'text',
          is_nullable: true,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
      ],
    },
    {
      name: 'projects',
      schema: 'public',
      row_count_estimate: 340,
      primary_key_columns: ['id'],
      indexes: [
        {
          name: 'projects_pkey',
          column_names: ['id'],
          is_unique: true,
          is_primary: true,
        },
      ],
      columns: [
        {
          name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: 'gen_random_uuid()',
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: null,
        },
        {
          name: 'owner_user_id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: {
            referenced_table: 'users',
            referenced_column: 'id',
            referenced_schema: 'public',
          },
        },
        {
          name: 'name',
          data_type: 'text',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
      ],
    },
    {
      name: 'project_members',
      schema: 'public',
      row_count_estimate: 2890,
      primary_key_columns: ['project_id', 'user_id'],
      indexes: [
        {
          name: 'project_members_pkey',
          column_names: ['project_id', 'user_id'],
          is_unique: true,
          is_primary: true,
        },
      ],
      columns: [
        {
          name: 'project_id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: null,
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: {
            referenced_table: 'projects',
            referenced_column: 'id',
            referenced_schema: 'public',
          },
        },
        {
          name: 'user_id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: null,
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: {
            referenced_table: 'users',
            referenced_column: 'id',
            referenced_schema: 'public',
          },
        },
        {
          name: 'role',
          data_type: 'text',
          is_nullable: false,
          default_value: "'member'",
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
      ],
    },
    {
      name: 'customers',
      schema: 'billing',
      row_count_estimate: 950,
      primary_key_columns: ['id'],
      indexes: [
        {
          name: 'customers_pkey',
          column_names: ['id'],
          is_unique: true,
          is_primary: true,
        },
        {
          name: 'customers_stripe_customer_id_key',
          column_names: ['stripe_customer_id'],
          is_unique: true,
          is_primary: false,
        },
      ],
      columns: [
        {
          name: 'id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: 'gen_random_uuid()',
          is_primary_key: true,
          is_auto_increment: false,
          foreign_key: null,
        },
        {
          name: 'user_id',
          data_type: 'uuid',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: {
            referenced_table: 'users',
            referenced_column: 'id',
            referenced_schema: 'public',
          },
        },
        {
          name: 'stripe_customer_id',
          data_type: 'text',
          is_nullable: false,
          default_value: null,
          is_primary_key: false,
          is_auto_increment: false,
          foreign_key: null,
        },
      ],
    },
  ],
}
```

## Fastest way to prototype with dummy data

If you want another design agent to work with no backend dependency, use this
workflow.

1. In `schema-visualizer.tsx`, temporarily skip `adapter.getSchema(...)`.
2. Set local state from `mockSchema`.
3. Keep `useSchemaGraph(mockSchema, deferredSearch)` exactly as-is.
4. Render the current toolbar, graph, and inspector against the mock data.
5. Redesign only after the feature is stable with fake data.

That path preserves the graph semantics while freeing the redesign from
backend/API concerns.

## Recommended scope for a design-only pass

If the goal is visual redesign rather than feature changes, focus on these
files only.

- `apps/desktop/src/features/schema-visualizer/schema-visualizer.tsx`
- `apps/desktop/src/features/schema-visualizer/components/schema-toolbar.tsx`
- `apps/desktop/src/features/schema-visualizer/components/table-node.tsx`
- `apps/desktop/src/features/schema-visualizer/components/schema-details-panel.tsx`
- `apps/desktop/src/index.css`

Leave these files alone unless the redesign requires behavior changes.

- `apps/desktop/src/features/schema-visualizer/hooks/use-schema-graph.ts`
- `apps/desktop/src/features/schema-visualizer/components/relationship-edge.tsx`
- `apps/desktop/src/lib/bindings.ts`
- `apps/desktop/src/pages/Index.tsx`

## Known design pressure points

These are the main reasons the current screen feels messy.

- The toolbar tries to carry search, counts, export, layout controls, and
  refresh in one band.
- The table cards have high information density with weak spacing hierarchy.
- The inspector mixes summary, actions, columns, and code output in one panel.
- The feature styling lives in global CSS, which makes iteration more brittle.
- The graph canvas, controls, and inspector compete for attention at the same
  visual depth.

## Next steps

Use this handoff doc plus the mock schema to let another design agent rebuild
the screen in isolation. If you want, the next useful artifact is a second doc
that narrows the redesign brief into concrete goals such as layout direction,
information hierarchy, and interaction constraints.

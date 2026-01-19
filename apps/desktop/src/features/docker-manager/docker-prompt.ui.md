# Docker Container Manager — UI Generation Prompt

Generate a complete, production-ready React UI for a Docker container management view in a desktop database tool application.

---

## Design System Context

This UI integrates into an existing Tauri desktop application with:
- Dark theme by default
- `shadcn/ui` components
- Tailwind CSS
- Lucide React icons
- React Query for data fetching

Use this color palette:
- Background: `bg-background` (dark charcoal)
- Cards: `bg-card` with subtle borders
- Accent: emerald/green tones for positive actions
- Destructive: red tones for dangerous actions
- Muted text: `text-muted-foreground`

---

## Required Components

### 1. DockerView (Main Container)

Full-height layout with:
- Header bar with title "Docker Containers" and "Sandbox Mode Active" badge (green pill, lock icon)
- Toolbar: search input, filter toggles, "+ New Container" button
- Split view: container list (left/main) + details panel (right, collapsible)

```
┌──────────────────────────────────────────────────────────────────────┐
│  🐳 Docker Containers                    🔒 Sandbox Mode Active      │
├──────────────────────────────────────────────────────────────────────┤
│  🔍 Search containers...   ☑ Show dora_ only   ☐ Show all           │
│                                                    [+ New Container] │
├────────────────────────────────────┬─────────────────────────────────┤
│  Container List                    │  Container Details              │
│  ┌─────────────────────────────┐  │  ┌─────────────────────────────┐│
│  │ 🟢 dora_dev_001             │  │  │ dora_dev_001                ││
│  │    postgres:16 | :5433      │  │  │ Status: Running (healthy)   ││
│  │    Created 2h ago           │  │  │ Image: postgres:16          ││
│  └─────────────────────────────┘  │  │                             ││
│  ┌─────────────────────────────┐  │  │ Connection                  ││
│  │ ⚫ dora_test (stopped)      │  │  │ ├ Host: localhost           ││
│  │    postgres:15 | :5434      │  │  │ ├ Port: 5433                ││
│  └─────────────────────────────┘  │  │ ├ User: postgres            ││
│  ┌─────────────────────────────┐  │  │ ├ Password: ••••••••        ││
│  │ ⚪ redis_cache [external]   │  │  │ └ Database: dora_dev        ││
│  │    redis:7 | :6379          │  │  │                             ││
│  └─────────────────────────────┘  │  │ [📋 Copy Env] [🔗 Open in   ││
│                                    │  │              Data Viewer]   ││
│                                    │  │                             ││
│                                    │  │ Actions                     ││
│                                    │  │ [Stop] [Restart] [Remove]   ││
│                                    │  │                             ││
│                                    │  │ Logs | Seed                 ││
│                                    │  │ ─────────────────────────   ││
│                                    │  │ [Logs content or seed UI]   ││
│                                    │  └─────────────────────────────┘│
└────────────────────────────────────┴─────────────────────────────────┘
```

### 2. ContainerList

- Scrollable list of container cards
- Each card shows:
  - Status indicator (colored dot: green=running, gray=stopped, yellow=starting)
  - Container name (bold)
  - Image name and tag
  - Port mapping (host:container)
  - Relative creation time
  - "external" badge if not created by this feature
- Hover state with subtle highlight
- Click to select (updates details panel)
- Context menu on right-click: Start, Stop, Remove, Copy ID

### 3. ContainerCard

```tsx
type ContainerCardProps = {
  container: DockerContainer;
  isSelected: boolean;
  onSelect: (id: string) => void;
};
```

Visual states:
- Default: subtle border
- Selected: accent border + slight background tint
- Hover: border highlight

### 4. CreateContainerDialog

Modal dialog with form:

```
┌─────────────────────────────────────────────────────────────┐
│  Create PostgreSQL Container                            ✕   │
├─────────────────────────────────────────────────────────────┤
│  Container Name                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ dora_dev_001                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  Prefix "dora_" is required                                 │
│                                                             │
│  PostgreSQL Version                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 16 (Latest)                                     ▼   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Host Port                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 5433                             [🔄 Find Free]     │   │
│  └─────────────────────────────────────────────────────┘   │
│  Auto-detected free port                                    │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ Username          │  │ Password          │              │
│  │ postgres          │  │ ••••••••    👁    │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                             │
│  Database Name                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ dora_dev                                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Storage                                                    │
│  ○ Ephemeral (data lost on remove)                         │
│  ○ Persistent volume                                        │
│    Volume name: dora_dev_001_data                          │
│                                                             │
│  ▸ Advanced Options                                         │
│    CPU Limit: [    ] cores                                  │
│    Memory Limit: [    ] MB                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Create Container]   │
└─────────────────────────────────────────────────────────────┘
```

### 5. ContainerDetailsPanel

Right panel showing selected container details:
- Header: container name + status badge
- Connection section:
  - All connection parameters in copyable format
  - "Copy Env" button (copies DATABASE_URL, PG* vars)
  - "Open in Data Viewer" button
- Actions section:
  - Start/Stop/Restart buttons
  - Remove button (with confirmation)
- Tabbed section:
  - Logs tab: scrollable log output with auto-scroll
  - Seed tab: database population options

### 6. EnvCopyButton

Copy button that copies this format to clipboard:

```
DATABASE_URL=postgres://postgres:password@localhost:5433/dora_dev
PGHOST=localhost
PGPORT=5433
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=dora_dev
```

Show toast on copy success.

### 7. LogsViewer

- Monospace font
- Dark background
- Auto-scroll to bottom
- Tail parameter (show last 100/500/1000 lines)
- Refresh button
- Clear button (visual only)

### 8. SeedPanel

```
┌─────────────────────────────────────────────────────────────┐
│  Seed Database                                              │
├─────────────────────────────────────────────────────────────┤
│  Choose how to populate data:                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📄 SQL File(s)                                      │   │
│  │  Upload and execute SQL scripts                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  💾 Restore pg_dump                                  │   │
│  │  Restore from a PostgreSQL dump file                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🎲 Generate Test Data                               │   │
│  │  Create synthetic data for testing                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

[When SQL File selected:]
┌─────────────────────────────────────────────────────────────┐
│  SQL Files                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Drop files here or click to browse                  │   │
│  │  📁                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Files to execute:                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. schema.sql                              [✕]      │   │
│  │ 2. seed_users.sql                          [✕]      │   │
│  │ 3. seed_orders.sql                         [✕]      │   │
│  └─────────────────────────────────────────────────────┘   │
│  Files execute in order shown. Drag to reorder.            │
│                                                             │
│                                    [Execute SQL Files]      │
└─────────────────────────────────────────────────────────────┘

[When Generate Test Data selected:]
┌─────────────────────────────────────────────────────────────┐
│  Test Data Generator                                        │
│                                                             │
│  Profile                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ E-Commerce (users, products, orders)            ▼   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Scale                                                      │
│  ○ Small (1K rows)                                         │
│  ○ Medium (10K rows)                                        │
│  ● Large (100K rows)                                        │
│  ○ XL (1M rows)                                            │
│                                                             │
│  Estimated time: ~45 seconds                                │
│                                                             │
│                               [Generate Data]               │
└─────────────────────────────────────────────────────────────┘

[Progress state:]
┌─────────────────────────────────────────────────────────────┐
│  Seeding Database...                                        │
│                                                             │
│  ████████████████████░░░░░░░░░░ 65%                        │
│                                                             │
│  Inserting orders table... (65,432 rows)                    │
│                                                             │
│                                   [Cancel]                  │
└─────────────────────────────────────────────────────────────┘

[Completed state:]
┌─────────────────────────────────────────────────────────────┐
│  ✅ Seed Complete                                           │
│                                                             │
│  Summary:                                                   │
│  ├ Tables created: 5                                        │
│  ├ Rows inserted: 102,847                                   │
│  └ Data size: 48.3 MB                                       │
│                                                             │
│  Time elapsed: 47.2 seconds                                 │
│                                                             │
│              [Seed Again]  [Open in Data Viewer]            │
└─────────────────────────────────────────────────────────────┘
```

### 9. SandboxIndicator

Prominent badge in header:
- Green background with lock icon
- Text: "Sandbox Mode Active"
- Tooltip explaining sandbox protection
- Always visible when in Docker view

### 10. RemoveContainerDialog

Confirmation dialog:

```
┌─────────────────────────────────────────────────────────────┐
│  Remove Container                                       ✕   │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Are you sure you want to remove "dora_dev_001"?        │
│                                                             │
│  This will stop and remove the container.                   │
│                                                             │
│  ☐ Also remove associated data volume                       │
│    (dora_dev_001_data - 48.3 MB)                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                  [Cancel]  [Remove]         │
└─────────────────────────────────────────────────────────────┘
```

---

## Component File Structure

```
src/features/docker-manager/
├── components/
│   ├── docker-view.tsx
│   ├── container-list.tsx
│   ├── container-card.tsx
│   ├── container-details-panel.tsx
│   ├── create-container-dialog.tsx
│   ├── remove-container-dialog.tsx
│   ├── env-copy-button.tsx
│   ├── logs-viewer.tsx
│   ├── seed-panel.tsx
│   ├── sandbox-indicator.tsx
│   └── status-badge.tsx
└── index.ts
```

---

## State Management

Use React Query for server state:

```typescript
const { data: containers } = useQuery({
  queryKey: ["docker-containers", { prefix, showAll }],
  queryFn: fetchContainers,
  refetchInterval: 2000,
});

const createMutation = useMutation({
  mutationFn: createContainer,
  onSuccess: () => queryClient.invalidateQueries(["docker-containers"]),
});
```

Local state for UI:
- `selectedContainerId: string | null`
- `isCreateDialogOpen: boolean`
- `detailsTab: "logs" | "seed"`
- `seedStrategy: SeedStrategyType`

---

## Interactions

### Container Selection
- Click container card → update `selectedContainerId`
- Details panel slides in/updates with selected container

### Create Container Flow
1. Click "+ New Container" → open dialog
2. Fill form (auto-suggest name, auto-detect port)
3. Submit → show loading state
4. Success → close dialog, select new container
5. Error → show error in dialog, keep open

### Copy Env
1. Click "Copy Env" button
2. Build env string from container config
3. Copy to clipboard via `navigator.clipboard`
4. Show success toast

### Seed Database
1. Select strategy
2. Configure (upload files / select profile)
3. Click execute
4. Show progress
5. Show summary on complete

### Remove Container
1. Click "Remove"
2. Show confirmation dialog
3. Optional: check "remove volumes"
4. Confirm → remove → deselect

---

## Accessibility

- All interactive elements focusable
- Keyboard navigation through container list
- ARIA labels on icon-only buttons
- Focus trap in dialogs
- Announce status changes to screen readers

---

## Empty States

### No Containers

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🐳                                  │
│                                                             │
│           No containers yet                                 │
│                                                             │
│   Create your first PostgreSQL container to start          │
│   working with local development databases.                 │
│                                                             │
│                   [+ Create Container]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### No Container Selected

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         📦                                  │
│                                                             │
│           Select a container                                │
│                                                             │
│   Click on a container from the list to view               │
│   its details and available actions.                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Docker Not Available

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         ⚠️                                  │
│                                                             │
│           Docker not available                              │
│                                                             │
│   Unable to connect to Docker. Make sure Docker is         │
│   installed and running on your system.                     │
│                                                             │
│   $ sudo systemctl start docker                             │
│   $ sudo usermod -aG docker $USER                           │
│                                                             │
│                      [Retry]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

- Details panel collapses to bottom sheet on narrow screens
- Container cards stack in single column on mobile
- Toolbar wraps gracefully
- Dialog is max-width constrained, centered

---

Generate all components with TypeScript, proper typing, and following the existing codebase conventions. Use function declarations (not arrow functions). Do not add code comments.

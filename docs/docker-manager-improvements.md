# Docker Manager — Improvement Plan

Actionable items derived from a full UX/UI, accessibility, performance, and feature audit.
Each item includes the target file(s), what to change, and acceptance criteria.

---

## UX/UI

### 1. Resizable details panel
- **Files:** `container-details-panel.tsx`, `docker-view.tsx`
- **What:** Replace the fixed `w-80` panel with a resizable split pane (drag handle between list and details). Persist width to Zustand store.
- **AC:** User can drag the divider. Min width 280px, max 50% of viewport. Width persists across sessions.

### 2. Empty state for search vs no containers
- **Files:** `container-list.tsx`
- **What:** Accept a `searchQuery` prop. When `containers.length === 0 && searchQuery`, render "No containers match `{query}`" with a clear-search button. Keep existing empty state for genuinely zero containers.
- **AC:** Searching a term that matches nothing shows a distinct message with a button to reset the search.

### 3. Add "created" status filter chip
- **Files:** `docker-view.tsx`
- **What:** Add `'created'` to the status filter badge array at line 275. Currently only renders `all | running | stopped`.
- **AC:** Four filter chips visible: All, Running, Stopped, Created.

### 4. Toggleable sort direction
- **Files:** `docker-view.tsx`
- **What:** Add an ascending/descending toggle button next to the sort dropdown. Store direction in state.
- **AC:** Clicking the toggle flips sort order. Arrow icon reflects current direction.

### 5. Make seed drop zone clickable
- **Files:** `seed-view.tsx`
- **What:** Attach `onClick={() => fileInputRef.current?.click()}` to the outer drop zone `<div>`, not just the button. The "or click to browse" text currently lies.
- **AC:** Clicking anywhere in the dashed drop zone opens the file picker.

### 6. Keyboard navigation for container list
- **Files:** `container-list.tsx`, `container-card.tsx`
- **What:** Add ArrowUp/ArrowDown key handlers on the list wrapper. Maintain a focused index. When a card is focused and user presses arrow keys, move focus to the adjacent card.
- **AC:** User can navigate the container list with arrow keys without tabbing through every card.

---

## Accessibility

### 7. `aria-label` on all icon-only buttons
- **Files:** `container-card.tsx`, `connection-details.tsx`, `create-container-dialog.tsx`, `compose-export-dialog.tsx`
- **What:** Every `<button>` or `<Button>` that renders only an icon must have an explicit `aria-label`. Replace `title` with `aria-label` (or use both).
- **Targets:**
  - `QuickActionButton` — add `aria-label={title}` prop
  - Password toggle in `connection-details.tsx:121` — `aria-label={showPassword ? 'Hide password' : 'Show password'}`
  - Password toggle in `create-container-dialog.tsx:252` — same
  - Copy snippet button in `connection-details.tsx:168` — `aria-label="Copy snippet"`
  - Refresh port button in `create-container-dialog.tsx:212` — `aria-label="Find free port"`
- **AC:** axe/Lighthouse reports zero "button has no accessible name" violations in the Docker Manager feature.

### 8. Keyboard support on filter badges
- **Files:** `docker-view.tsx`
- **What:** The status filter `<Badge>` components are clickable divs. Add `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) handlers. Alternatively, render them as `<button>` elements styled as badges.
- **AC:** User can tab to each filter badge and activate it with Enter or Space.

### 9. `role="status"` on StatusBadge
- **Files:** `status-badge.tsx`
- **What:** Add `role="status"` and `aria-label={label}` to the outer `<div>`. This ensures screen readers announce the container state.
- **AC:** Screen reader announces "healthy", "running", "stopped", etc. when StatusBadge is in focus context.

### 10. `aria-live` region for logs viewer
- **Files:** `logs-viewer.tsx`
- **What:** Add `aria-label="Container logs"` and `aria-live="polite"` to the logs scroll container. This announces new log content to screen readers without being disruptive.
- **AC:** When new logs appear, assistive tech announces the update.

### 11. Color-blind-safe status indicators
- **Files:** `status-badge.tsx`
- **What:** Add a secondary visual cue beyond color: a distinct icon per state (checkmark for healthy, spinner for starting, X for unhealthy, pause icon for paused, circle for created). Or add a subtle text-shape indicator inside the dot.
- **AC:** Status is distinguishable without relying on color alone. Passes WCAG 1.4.1.

### 12. Accessible drag-and-drop zone
- **Files:** `seed-view.tsx`
- **What:** Add `role="button"`, `aria-label="Upload SQL file"`, `tabIndex={0}`, and keyboard activation (Enter/Space opens file picker) to the drop zone div. Add instructional text: "Drag and drop or press Enter to browse".
- **AC:** Keyboard-only users can activate the file picker from the drop zone. Screen readers announce its purpose.

---

## Performance

### 13. Eliminate dual container fetch
- **Files:** `docker-view.tsx`
- **What:** Fetch all containers once (always `showExternal: true`). Compute the filtered list and external count client-side from the single query result.
- **AC:** Network tab shows one `docker ps` call per poll cycle instead of two. `externalCount` still displays correctly.

### 14. Virtualize logs viewer
- **Files:** `logs-viewer.tsx`
- **What:** Use `@tanstack/react-virtual` (already in the React Query ecosystem) or `react-window` to virtualize log lines. Only render visible lines in the DOM.
- **AC:** Selecting "5000 lines" tail does not cause frame drops. DOM contains ~50 elements regardless of log count.

### 15. Lazy-load container list (optional, low priority)
- **Files:** `container-list.tsx`
- **What:** If container count exceeds 50, virtualize the card list with `react-window`. Below 50, render directly.
- **AC:** Scrolling through 100+ containers maintains 60fps.

### 16. Recompute Compose YAML on container change
- **Files:** `compose-export-dialog.tsx`
- **What:** Replace `useState(() => generateDockerCompose(container))` with `useMemo(() => generateDockerCompose(container), [container])` so it updates if the container object changes while the dialog is open.
- **AC:** If container state changes while export dialog is open, the YAML reflects the latest state.

---

## Features

### 17. Surface resource usage metrics
- **Files:** `container-details-panel.tsx`, `docker-client.ts` (already has `getContainerSizes`)
- **What:** Add a "Resources" section in the details panel showing CPU %, memory usage, and disk size. Poll via React Query at 5s intervals when the details panel is open.
- **AC:** Running container shows live CPU/memory bars and disk usage. Stopped container shows "N/A".

### 18. Container networking info
- **Files:** `container-details-panel.tsx`, `docker-client.ts`
- **What:** Show container IP address, network name, and exposed ports in a collapsible "Networking" section in the details panel. Data comes from `docker inspect`.
- **AC:** User can see the container's internal IP and which Docker networks it belongs to.

### 19. Bulk actions
- **Files:** `docker-view.tsx`, `container-list.tsx`, `container-card.tsx`
- **What:** Add a multi-select mode (checkbox on each card, "Select All" in toolbar). When selection > 0, show a bulk action bar with Start All / Stop All / Remove All buttons.
- **AC:** User can select multiple containers and perform batch start/stop/remove.

### 20. Database backup (pg_dump)
- **Files:** `seed-view.tsx` (or new `backup-view.tsx`), `container-service.ts`
- **What:** Add a "Backup" tab or button that runs `pg_dump` inside the container and saves the output to a user-chosen file path via Tauri save dialog. The `SeedStrategy` type already includes `pg_dump` but it's not wired up.
- **AC:** User can export a `.sql` dump of the container's database to disk.

---

## Priority Matrix

| # | Item | Effort | Impact | Priority |
|---|------|--------|--------|----------|
| 7 | aria-label on icon buttons | S | High | P0 |
| 5 | Clickable seed drop zone | XS | Med | P0 |
| 2 | Search empty state | S | Med | P0 |
| 8 | Keyboard filter badges | S | High | P0 |
| 13 | Eliminate dual fetch | S | Med | P1 |
| 3 | "Created" filter chip | XS | Low | P1 |
| 9 | StatusBadge role | XS | Med | P1 |
| 10 | Logs aria-live | XS | Med | P1 |
| 12 | Accessible drop zone | S | Med | P1 |
| 16 | Compose YAML useMemo | XS | Low | P1 |
| 4 | Sort direction toggle | S | Low | P2 |
| 6 | Arrow key list nav | M | Med | P2 |
| 11 | Color-blind status icons | M | Med | P2 |
| 1 | Resizable details panel | M | Med | P2 |
| 14 | Virtualize logs | M | High | P2 |
| 17 | Resource usage metrics | L | High | P3 |
| 18 | Container networking info | M | Med | P3 |
| 19 | Bulk actions | L | Med | P3 |
| 20 | Database backup | M | High | P3 |
| 15 | Virtualize container list | S | Low | P3 |

**Effort:** XS (<30min), S (1-2h), M (2-4h), L (4-8h)
**Priority:** P0 = do first, P1 = do soon, P2 = next sprint, P3 = backlog

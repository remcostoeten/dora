# Keyboard Shortcuts — Implementation Spec

## Current State (do NOT re-implement these — already working)

| What | File | Status |
|------|------|--------|
| `@remcostoeten/use-shortcut` installed | `package.json` | ✅ |
| `useShortcut` wrapper with `.bind()` | `src/core/shortcuts/shortcuts.ts` | ✅ |
| `APP_SHORTCUTS` definition | `src/core/shortcuts/shortcuts.ts` | ✅ partial |
| Zustand store with `persist` | `src/core/shortcuts/store.ts` | ✅ |
| `useEffectiveShortcuts()` | `src/core/shortcuts/store.ts` | ✅ |
| `ShortcutRecorder` component | `src/features/sidebar/components/shortcut-recorder.tsx` | ✅ |
| Settings panel shortcut list | `src/features/sidebar/components/settings-panel.tsx` | ✅ basic |
| Shortcuts bound in data-grid | `src/features/database-studio/components/data-grid.tsx` | ✅ partial |
| Shortcuts bound in sql-console | `src/features/sql-console/sql-console.tsx` | ✅ partial |

**Import path for everything:** `import { ... } from '@/core/shortcuts'`

---

## What Needs Building

1. **Add missing shortcuts** to `APP_SHORTCUTS` in `src/core/shortcuts/shortcuts.ts`
2. **Add scope activation** — features must call `$.enableScope()`/`$.disableScope()` on mount/unmount
3. **Wire navigation shortcuts** in the right place (currently nothing handles `nav.*`)
4. **Add vim-style chord sequences** (`g d`, `g s`, `g c`)
5. **Add competitor shortcuts** (`Mod+T`, `Mod+1-9`, `F5`, `Mod+G`)
6. **Expand settings panel** with category grouping and scope labels

---

## Step 1 — Add All Shortcuts to APP_SHORTCUTS

**File:** `src/core/shortcuts/shortcuts.ts`

Replace/extend the `APP_SHORTCUTS` object. Keep existing keys unchanged (they are already bound in features). Add the new ones below.

```ts
export const APP_SHORTCUTS = {
  // ── EXISTING (do not change) ────────────────────────────────────────────
  openCommandPalette: {
    combo: 'mod+k',
    description: 'Open command palette',
    scope: 'global',
  },
  selectAll: {
    combo: 'mod+a',
    description: 'Select all rows',
    scope: 'data-grid',
  },
  deselect: {
    combo: ['escape', 'mod+d', 'd'],
    description: 'Deselect all',
    scope: 'data-grid',
  },
  deleteRows: {
    combo: ['delete', 'shift+backspace'],
    description: 'Delete selected rows',
    scope: 'data-grid',
  },
  focusToolbar: {
    combo: 'alt+t',
    description: 'Focus toolbar',
    scope: 'data-grid',
  },
  runQuery: {
    combo: 'mod+enter',
    description: 'Run query',
    scope: 'sql-console',
  },
  save: {
    combo: 'mod+s',
    description: 'Save',
    scope: 'global',
  },
  find: {
    combo: 'mod+f',
    description: 'Find',
    scope: 'editor',
  },
  replace: {
    combo: 'mod+h',
    description: 'Replace',
    scope: 'editor',
  },
  toggleComment: {
    combo: 'mod+slash',
    description: 'Toggle comment',
    scope: 'editor',
  },
  selectNextOccurrence: {
    combo: 'mod+d',
    description: 'Select next occurrence',
    scope: 'editor',
  },
  moveLineUp: {
    combo: 'alt+up',
    description: 'Move line up',
    scope: 'editor',
  },
  moveLineDown: {
    combo: 'alt+down',
    description: 'Move line down',
    scope: 'editor',
  },
  deleteLine: {
    combo: 'mod+shift+k',
    description: 'Delete line',
    scope: 'editor',
  },

  // ── NEW: Query / SQL Console ────────────────────────────────────────────
  runSelection: {
    combo: 'mod+shift+enter',
    description: 'Run selected SQL',
    scope: 'sql-console',
  },
  formatQuery: {
    combo: 'mod+shift+f',
    description: 'Format SQL',
    scope: 'sql-console',
  },
  openQueryHistory: {
    combo: 'mod+shift+h',
    description: 'Open query history',
    scope: 'sql-console',
  },
  saveScript: {
    combo: 'mod+s',
    description: 'Save script',
    scope: 'sql-console',
  },
  goToLine: {
    combo: 'mod+g',
    description: 'Go to line',
    scope: 'editor',
  },
  newTab: {
    combo: 'mod+t',
    description: 'New query tab',
    scope: 'sql-console',
  },

  // ── NEW: Database Studio ────────────────────────────────────────────────
  refreshTable: {
    combo: ['mod+r', 'f5'],
    description: 'Refresh table',
    scope: 'data-grid',
  },
  filterRows: {
    combo: 'mod+shift+f',
    description: 'Filter rows',
    scope: 'data-grid',
  },
  insertRow: {
    combo: 'mod+shift+i',
    description: 'Insert row',
    scope: 'data-grid',
  },
  exportTable: {
    combo: 'mod+e',
    description: 'Export table',
    scope: 'data-grid',
  },
  startLiveMonitor: {
    combo: 'mod+shift+m',
    description: 'Start live monitor',
    scope: 'data-grid',
  },

  // ── NEW: Global Navigation ──────────────────────────────────────────────
  newConnection: {
    combo: 'mod+shift+n',
    description: 'Add connection',
    scope: 'global',
  },
  toggleSidebar: {
    combo: 'mod+b',
    description: 'Toggle sidebar',
    scope: 'global',
  },
  openSettings: {
    combo: 'mod+comma',
    description: 'Open settings',
    scope: 'global',
  },
  closeTab: {
    combo: 'mod+w',
    description: 'Close current tab',
    scope: 'global',
  },
  reconnect: {
    combo: 'mod+shift+r',
    description: 'Reconnect to database',
    scope: 'global',
  },
  // Switch connections by index (1-9)
  switchConnection1: { combo: 'mod+1', description: 'Switch to connection 1', scope: 'global' },
  switchConnection2: { combo: 'mod+2', description: 'Switch to connection 2', scope: 'global' },
  switchConnection3: { combo: 'mod+3', description: 'Switch to connection 3', scope: 'global' },
  switchConnection4: { combo: 'mod+4', description: 'Switch to connection 4', scope: 'global' },
  switchConnection5: { combo: 'mod+5', description: 'Switch to connection 5', scope: 'global' },
  switchConnection6: { combo: 'mod+6', description: 'Switch to connection 6', scope: 'global' },
  switchConnection7: { combo: 'mod+7', description: 'Switch to connection 7', scope: 'global' },
  switchConnection8: { combo: 'mod+8', description: 'Switch to connection 8', scope: 'global' },
  switchConnection9: { combo: 'mod+9', description: 'Switch to connection 9', scope: 'global' },

  // ── NEW: Vim-style Go-To chord sequences ───────────────────────────────
  // Note: chord syntax — 'g d' means press G, then D within sequenceTimeout (800ms)
  // Must use except: 'typing' so they don't fire in text inputs
  gotoDashboard:   { combo: 'g d', description: 'Go to dashboard',   scope: 'global' },
  gotoSettings:    { combo: 'g s', description: 'Go to settings',    scope: 'global' },
  gotoConnections: { combo: 'g c', description: 'Go to connections', scope: 'global' },
  gotoEditor:      { combo: 'g e', description: 'Go to SQL editor',  scope: 'global' },
  gotoDocker:      { combo: 'g k', description: 'Go to Docker',      scope: 'global' },
} as const satisfies Record<string, ShortcutDefinition>
```

**Also update the scope type** in `ShortcutDefinition`:
```ts
export type ShortcutDefinition = {
  combo: string | string[]
  description: string
  scope?: 'global' | 'data-grid' | 'sql-console' | 'editor'
}
```

**Also update `SHORTCUT_CATEGORIES`** for settings panel grouping (add after `APP_SHORTCUTS`):
```ts
export const SHORTCUT_CATEGORIES: Record<string, ShortcutName[]> = {
  'Navigation': [
    'openCommandPalette', 'newConnection', 'toggleSidebar', 'openSettings',
    'closeTab', 'reconnect',
    'switchConnection1', 'switchConnection2', 'switchConnection3',
    'switchConnection4', 'switchConnection5', 'switchConnection6',
    'switchConnection7', 'switchConnection8', 'switchConnection9',
  ],
  'Go To (chord: G → key)': [
    'gotoDashboard', 'gotoSettings', 'gotoConnections', 'gotoEditor', 'gotoDocker',
  ],
  'SQL Console': [
    'runQuery', 'runSelection', 'formatQuery', 'saveScript',
    'openQueryHistory', 'newTab',
  ],
  'Editor': [
    'find', 'replace', 'toggleComment', 'selectNextOccurrence',
    'moveLineUp', 'moveLineDown', 'deleteLine', 'goToLine',
  ],
  'Database Studio': [
    'selectAll', 'deselect', 'deleteRows', 'focusToolbar',
    'refreshTable', 'filterRows', 'insertRow', 'exportTable', 'startLiveMonitor',
  ],
  'Global': ['save'],
}
```

---

## Step 2 — Scope Activation in Features

Features must tell the shortcut system which scope is active. Without this, scoped shortcuts either fire everywhere or never fire.

**Pattern:** call `$.enableScope(scope)` on mount, `$.disableScope(scope)` on unmount.

**Add `useActiveScope` hook** to `src/core/shortcuts/shortcuts.ts`:

```ts
import { useEffect } from 'react'

export function useActiveScope(
  $: ShortcutBuilder,
  scope: ShortcutDefinition['scope']
) {
  useEffect(() => {
    if (!scope || scope === 'global') return
    $.enableScope(scope)
    return () => $.disableScope(scope)
  }, [scope])
}
```

**Wire it in each feature:**

```tsx
// src/features/sql-console/sql-console.tsx
const $ = useShortcut()
useActiveScope($, 'sql-console')
// existing $.bind('mod+enter').on(runQuery) stays unchanged

// src/features/database-studio/components/data-grid.tsx
const $ = useShortcut()
useActiveScope($, 'data-grid')

// src/features/drizzle-runner/drizzle-runner.tsx
const $ = useShortcut()
useActiveScope($, 'editor')  // drizzle runner uses editor scope
```

---

## Step 3 — Wire Navigation Shortcuts

Navigation shortcuts (`newConnection`, `toggleSidebar`, `openSettings`, `closeTab`, `reconnect`, `switchConnection1-9`) need to be bound somewhere that knows the navigation handlers.

**Best location:** `src/pages/Index.tsx` — already has `useShortcut` and `useEffectiveShortcuts`.

```tsx
// src/pages/Index.tsx — add these bindings alongside existing openCommandPalette binding
const $ = useShortcut()
const effectiveShortcuts = useEffectiveShortcuts()

// Already exists:
$.bind(effectiveShortcuts.openCommandPalette.combo).on(() => setCommandPaletteOpen(true), { ignoreInputs: false })

// Add:
$.bind(effectiveShortcuts.newConnection.combo).on(() => setConnectionDialogOpen(true))
$.bind(effectiveShortcuts.toggleSidebar.combo).on(() => setSidebarCollapsed(c => !c))
$.bind(effectiveShortcuts.openSettings.combo).on(() => setSettingsOpen(true))
$.bind(effectiveShortcuts.reconnect.combo).on(() => reconnectCurrentConnection())

// Connection switching — bind all 9, handler uses index
connections.slice(0, 9).forEach((conn, i) => {
  const key = `switchConnection${i + 1}` as ShortcutName
  $.bind(effectiveShortcuts[key].combo).on(() => activateConnection(conn.id))
})
```

---

## Step 4 — Vim Chord Sequences

The chord shortcuts (`gotoDashboard: 'g d'`) need `.except('typing')` so they don't fire in Monaco or inputs. The library supports space-separated chord syntax natively.

**Also in `src/pages/Index.tsx`** (navigation is available there):

```tsx
import { useNavigate } from 'react-router-dom'

const navigate = useNavigate()

// Chord sequences — except typing so Monaco doesn't intercept
$.bind(effectiveShortcuts.gotoDashboard.combo)
  .except('typing')
  .on(() => navigate('/'))

$.bind(effectiveShortcuts.gotoSettings.combo)
  .except('typing')
  .on(() => setSettingsOpen(true))

$.bind(effectiveShortcuts.gotoConnections.combo)
  .except('typing')
  .on(() => navigate('/connections'))

$.bind(effectiveShortcuts.gotoEditor.combo)
  .except('typing')
  .on(() => navigate('/editor'))

$.bind(effectiveShortcuts.gotoDocker.combo)
  .except('typing')
  .on(() => navigate('/docker'))
```

> **Note:** Check if Dora uses React Router or another routing mechanism. If navigation is sidebar-driven (not URL-based), replace `navigate('/x')` with the appropriate sidebar state setter.

---

## Step 5 — Settings Panel: Category Grouping

**File:** `src/features/sidebar/components/settings-panel.tsx`

Currently renders a flat list. Change to grouped by `SHORTCUT_CATEGORIES`.

```tsx
import { SHORTCUT_CATEGORIES } from '@/core/shortcuts'

// Replace the existing Object.entries(effectiveShortcuts).map(...) with:
{Object.entries(SHORTCUT_CATEGORIES).map(([category, names]) => (
  <div key={category} className="mb-4">
    <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider px-1">
      {category}
    </div>
    <div className="space-y-1">
      {names.map(name => {
        const def = effectiveShortcuts[name]
        const isOverridden = name in overrides
        return (
          <div key={name} className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-sidebar-accent/30">
            <div className="flex flex-col">
              <span className="text-xs text-sidebar-foreground">{def.description}</span>
              {isOverridden && (
                <span className="text-[10px] text-muted-foreground">customized</span>
              )}
            </div>
            <ShortcutRecorder
              value={def.combo}
              onChange={combo => setShortcut(name, combo)}
              onReset={() => resetShortcut(name)}
              isDefault={!isOverridden}
            />
          </div>
        )
      })}
    </div>
  </div>
))}
```

---

## Complete Shortcut Table

`Mod` = `⌘` on Mac, `Ctrl` on Windows/Linux (handled by library automatically).

### Global
| Key | ID | Action |
|-----|----|--------|
| `Mod+K` | `openCommandPalette` | Open command palette |
| `Mod+S` | `save` | Save |
| `Mod+Shift+N` | `newConnection` | Add connection |
| `Mod+B` | `toggleSidebar` | Toggle sidebar |
| `Mod+,` | `openSettings` | Open settings |
| `Mod+W` | `closeTab` | Close tab |
| `Mod+Shift+R` | `reconnect` | Reconnect |
| `Mod+1` … `Mod+9` | `switchConnection1-9` | Switch to connection N |

### Go To (chord — press G then key)
| Chord | ID | Action |
|-------|----|--------|
| `G` → `D` | `gotoDashboard` | Dashboard |
| `G` → `S` | `gotoSettings` | Settings |
| `G` → `C` | `gotoConnections` | Connections |
| `G` → `E` | `gotoEditor` | SQL editor |
| `G` → `K` | `gotoDocker` | Docker manager |

### SQL Console (scope: `sql-console`)
| Key | ID | Action |
|-----|----|--------|
| `Mod+Enter` | `runQuery` | Run query |
| `Mod+Shift+Enter` | `runSelection` | Run selected SQL |
| `Mod+Shift+F` | `formatQuery` | Format SQL |
| `Mod+S` | `saveScript` | Save script |
| `Mod+Shift+H` | `openQueryHistory` | Query history |
| `Mod+T` | `newTab` | New query tab |

### Editor (scope: `editor`)
| Key | ID | Action |
|-----|----|--------|
| `Mod+F` | `find` | Find |
| `Mod+H` | `replace` | Replace |
| `Mod+/` | `toggleComment` | Toggle comment |
| `Mod+D` | `selectNextOccurrence` | Select next occurrence |
| `Alt+↑` | `moveLineUp` | Move line up |
| `Alt+↓` | `moveLineDown` | Move line down |
| `Mod+Shift+K` | `deleteLine` | Delete line |
| `Mod+G` | `goToLine` | Go to line |

### Database Studio (scope: `data-grid`)
| Key | ID | Action |
|-----|----|--------|
| `Mod+A` | `selectAll` | Select all rows |
| `Escape` / `Mod+D` / `D` | `deselect` | Deselect |
| `Delete` / `Shift+Backspace` | `deleteRows` | Delete selected rows |
| `Mod+Shift+I` | `insertRow` | Insert row |
| `Mod+R` / `F5` | `refreshTable` | Refresh |
| `Mod+Shift+F` | `filterRows` | Filter rows |
| `Mod+E` | `exportTable` | Export |
| `Mod+Shift+M` | `startLiveMonitor` | Live monitor |
| `Alt+T` | `focusToolbar` | Focus toolbar |

---

## Architecture Summary (for next agent)

```
Library:    @remcostoeten/use-shortcut  (already installed)
Import:     import { ... } from '@/core/shortcuts'  (barrel re-exports everything)

Core files:
  src/core/shortcuts/shortcuts.ts   ← APP_SHORTCUTS + useActiveScope + SHORTCUT_CATEGORIES
  src/core/shortcuts/store.ts       ← Zustand persist store (overrides survive reload)
  src/core/shortcuts/index.ts       ← re-exports all of the above

Feature binding:
  src/pages/Index.tsx               ← global + navigation + chord sequences
  src/features/sql-console/         ← runQuery, runSelection, formatQuery, saveScript, newTab
  src/features/database-studio/     ← selectAll, deleteRows, insertRow, refreshTable, etc.
  src/features/drizzle-runner/      ← editor scope shortcuts

Settings UI:
  src/features/sidebar/components/settings-panel.tsx   ← grouped list + ShortcutRecorder
  src/features/sidebar/components/shortcut-recorder.tsx ← key capture (already works)

Persistence:
  Zustand persist (localStorage key: 'dora-shortcuts')
  overrides: Partial<Record<ShortcutName, string | string[]>>
  useEffectiveShortcuts() merges defaults + overrides → use this when binding
```

## Key API calls (exact)

```ts
// Binding with override support:
const effectiveShortcuts = useEffectiveShortcuts()
$.bind(effectiveShortcuts.runQuery.combo).on(handler)

// Scoped + except:
$.bind(combo).except('typing').on(handler)
$.bind(combo).in('sql-console').on(handler)

// Chord sequence — space separator:
$.bind('g d').except('typing').on(() => navigate('/'))

// Scope activation on mount:
$.enableScope('data-grid')  // in useEffect, return () => $.disableScope('data-grid')

// Recording (ShortcutRecorder already implements this manually via keydown events)
// Do NOT replace ShortcutRecorder with $.record() — the existing implementation works fine

// Display format (platform-aware):
formatShortcut('mod+k')   // → "⌘K" on Mac, "Ctrl+K" on Windows
```

## Checklist

- [ ] Extend `APP_SHORTCUTS` with all new keys above
- [ ] Add `SHORTCUT_CATEGORIES` export to `shortcuts.ts`
- [ ] Add `useActiveScope` hook to `shortcuts.ts`
- [ ] Call `useActiveScope($, 'sql-console')` in `sql-console.tsx`
- [ ] Call `useActiveScope($, 'data-grid')` in `data-grid.tsx`
- [ ] Call `useActiveScope($, 'editor')` in `drizzle-runner.tsx`
- [ ] Bind nav shortcuts in `Index.tsx` (newConnection, toggleSidebar, openSettings, reconnect)
- [ ] Bind `switchConnection1-9` in `Index.tsx`
- [ ] Bind chord sequences in `Index.tsx` with `.except('typing')`
- [ ] Bind studio shortcuts (insertRow, refreshTable, filterRows, exportTable, startLiveMonitor) in `database-studio.tsx`
- [ ] Bind new SQL Console shortcuts (runSelection, formatQuery, newTab, openQueryHistory) in `sql-console.tsx`
- [ ] Update settings panel to use `SHORTCUT_CATEGORIES` for grouped display
- [ ] Test: chord `g d` does NOT fire when typing in Monaco
- [ ] Test: scope isolation — studio shortcuts don't fire in SQL console
- [ ] Test: `Mod+1` switches to first connection
- [ ] Test: overriding a shortcut persists after reload

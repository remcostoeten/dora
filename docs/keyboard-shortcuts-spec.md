# Keyboard Shortcuts — Implementation Spec

Built on [`@remcostoeten/use-shortcut`](https://www.npmjs.com/package/@remcostoeten/use-shortcut).

---

## Architecture Overview

```
src/
  core/
    shortcuts/
      shortcut-registry.tsx     ← ShortcutProvider: creates builder, scope mgmt
      shortcut-map.ts           ← Central DORA_SHORTCUTS definition (ShortcutMap)
      use-dora-shortcuts.ts     ← Per-feature hook, returns typed results
      shortcut-scope.ts         ← Scope constants + useScope hook
      shortcut-store.ts         ← Persistence: read/write overrides to SQLite
      types.ts                  ← DoraShortcut, ShortcutCategory, etc.
  features/
    settings/
      components/
        keyboard-shortcuts-panel.tsx   ← Full settings UI
        shortcut-row.tsx               ← Single row: label | binding | record btn
        shortcut-conflict-badge.tsx    ← Shows conflict type
        shortcut-scope-filter.tsx      ← Filter by scope/category
```

---

## 1. Central Shortcut Map

**File:** `src/core/shortcuts/shortcut-map.ts`

Every shortcut defined once. No scattered `useShortcut()` calls per-feature.

```ts
import type { ShortcutMap } from '@remcostoeten/use-shortcut'

export const DORA_SHORTCUTS = {
  // ── Query ──────────────────────────────────────────
  'query.run': {
    keys: 'mod+enter',
    handler: null!,   // injected at registration time
    options: {
      description: 'Run query',
      scopes: ['sql-console'],
      except: 'input',  // except Monaco — it handles mod+enter internally
    },
  },
  'query.run-selection': {
    keys: 'mod+shift+enter',
    handler: null!,
    options: { description: 'Run selected SQL', scopes: ['sql-console'] },
  },
  'query.format': {
    keys: 'mod+shift+f',
    handler: null!,
    options: { description: 'Format SQL', scopes: ['sql-console'] },
  },
  'query.history': {
    keys: 'mod+h',
    handler: null!,
    options: { description: 'Open query history', scopes: ['sql-console'] },
  },

  // ── Navigation ─────────────────────────────────────
  'nav.command-palette': {
    keys: 'mod+k',
    handler: null!,
    options: { description: 'Open command palette' },
  },
  'nav.new-connection': {
    keys: 'mod+shift+n',
    handler: null!,
    options: { description: 'Add connection' },
  },
  'nav.focus-sidebar': {
    keys: 'mod+b',
    handler: null!,
    options: { description: 'Toggle sidebar' },
  },
  'nav.settings': {
    keys: 'mod+comma',
    handler: null!,
    options: { description: 'Open settings' },
  },
  'nav.close-tab': {
    keys: 'mod+w',
    handler: null!,
    options: { description: 'Close current tab' },
  },

  // ── Database Studio ────────────────────────────────
  'studio.refresh': {
    keys: 'mod+r',
    handler: null!,
    options: { description: 'Refresh table', scopes: ['database-studio'] },
  },
  'studio.filter': {
    keys: 'mod+f',
    handler: null!,
    options: { description: 'Filter rows', scopes: ['database-studio'] },
  },
  'studio.insert-row': {
    keys: 'mod+shift+i',
    handler: null!,
    options: { description: 'Insert row', scopes: ['database-studio'] },
  },
  'studio.delete-row': {
    keys: ['backspace', 'delete'],
    handler: null!,
    options: { description: 'Delete selected row(s)', scopes: ['database-studio'] },
  },
  'studio.export': {
    keys: 'mod+e',
    handler: null!,
    options: { description: 'Export table', scopes: ['database-studio'] },
  },

  // ── Vim-style navigation (sequences) ───────────────
  'goto.dashboard': {
    keys: 'g d',       // G then D  — use-shortcut chord syntax
    handler: null!,
    options: { description: 'Go to dashboard', except: 'typing' },
  },
  'goto.settings': {
    keys: 'g s',
    handler: null!,
    options: { description: 'Go to settings', except: 'typing' },
  },
  'goto.connections': {
    keys: 'g c',
    handler: null!,
    options: { description: 'Go to connections', except: 'typing' },
  },

  // ── Editor (SQL Console) ───────────────────────────
  'editor.save-script': {
    keys: 'mod+s',
    handler: null!,
    options: { description: 'Save script', scopes: ['sql-console'] },
  },
  'editor.find': {
    keys: 'mod+f',
    handler: null!,
    options: { description: 'Find in editor', scopes: ['sql-console'] },
  },
  'editor.comment-line': {
    keys: 'mod+slash',
    handler: null!,
    options: { description: 'Toggle line comment', scopes: ['sql-console'] },
  },

  // ── Live Monitor ───────────────────────────────────
  'monitor.start': {
    keys: 'mod+shift+m',
    handler: null!,
    options: { description: 'Start live monitor', scopes: ['database-studio'] },
  },

  // ── Global escape ──────────────────────────────────
  'global.escape': {
    keys: 'escape',
    handler: null!,
    options: { description: 'Close dialog / cancel', priority: -1 },
  },
} satisfies Record<string, Omit<import('@remcostoeten/use-shortcut').ShortcutMapEntry, 'handler'> & { handler: any }>

export type DoraShortcutId = keyof typeof DORA_SHORTCUTS

export const SHORTCUT_CATEGORIES: Record<string, DoraShortcutId[]> = {
  'Query':            ['query.run', 'query.run-selection', 'query.format', 'query.history', 'editor.save-script', 'editor.find', 'editor.comment-line'],
  'Navigation':       ['nav.command-palette', 'nav.new-connection', 'nav.focus-sidebar', 'nav.settings', 'nav.close-tab', 'global.escape'],
  'Database Studio':  ['studio.refresh', 'studio.filter', 'studio.insert-row', 'studio.delete-row', 'studio.export', 'monitor.start'],
  'Go To':            ['goto.dashboard', 'goto.settings', 'goto.connections'],
}
```

---

## 2. Scope Constants

**File:** `src/core/shortcuts/shortcut-scope.ts`

```ts
export const SCOPES = {
  SQL_CONSOLE:      'sql-console',
  DATABASE_STUDIO:  'database-studio',
  COMMAND_PALETTE:  'command-palette',
  SETTINGS:         'settings',
  DRIZZLE:          'drizzle',
} as const

export type ShortcutScope = typeof SCOPES[keyof typeof SCOPES]

// Hook for features to activate their scope on mount
import { useEffect } from 'react'
import { useShortcutContext } from './shortcut-registry'

export function useActiveScope(scope: ShortcutScope) {
  const { builder } = useShortcutContext()
  useEffect(() => {
    builder.enableScope(scope)
    return () => builder.disableScope(scope)
  }, [scope, builder])
}
```

**Usage in features:**
```tsx
// sql-console.tsx
export function SqlConsole() {
  useActiveScope(SCOPES.SQL_CONSOLE)
  // ...
}
```

---

## 3. Provider + Central Builder

**File:** `src/core/shortcuts/shortcut-registry.tsx`

Single `useShortcut()` call at app root. All features share one builder via context.

```tsx
import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { useShortcut, type ShortcutBuilder, type ShortcutResult } from '@remcostoeten/use-shortcut'
import { DORA_SHORTCUTS, type DoraShortcutId } from './shortcut-map'
import { loadShortcutOverrides } from './shortcut-store'

type ShortcutContextValue = {
  builder: ShortcutBuilder
  results: Partial<Record<DoraShortcutId, ShortcutResult>>
  register: (id: DoraShortcutId, handler: () => void) => ShortcutResult
  getDisplay: (id: DoraShortcutId) => string
  getCombo: (id: DoraShortcutId) => string
  rebind: (id: DoraShortcutId, newCombo: string) => void
  overrides: Record<DoraShortcutId, string>  // user-customized combos
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null)

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const overrides = useRef<Partial<Record<DoraShortcutId, string>>>(
    loadShortcutOverrides()
  )
  const results = useRef<Partial<Record<DoraShortcutId, ShortcutResult>>>({})

  const $ = useShortcut({
    conflictWarnings: true,
    onConflict: ({ combo, existingCombo, reason }) => {
      console.warn(`Shortcut conflict [${reason}]: "${combo}" vs "${existingCombo}"`)
    },
    sequenceTimeout: 800,
  })

  function register(id: DoraShortcutId, handler: () => void): ShortcutResult {
    // Unbind existing if re-registering
    results.current[id]?.unbind()

    const entry = DORA_SHORTCUTS[id]
    const combo = overrides.current[id] ?? entry.keys

    const result = $.bind(combo).on(handler, entry.options ?? {})
    results.current[id] = result
    return result
  }

  function rebind(id: DoraShortcutId, newCombo: string) {
    overrides.current[id] = newCombo
    saveShortcutOverride(id, newCombo)
    // Re-register with existing handler if bound
    const existing = results.current[id]
    if (existing) {
      // Capture handler via triggerFn — use a forwarder pattern
      existing.unbind()
    }
  }

  function getDisplay(id: DoraShortcutId): string {
    return results.current[id]?.display
      ?? formatShortcut(overrides.current[id] ?? DORA_SHORTCUTS[id].keys as string)
  }

  function getCombo(id: DoraShortcutId): string {
    return overrides.current[id] ?? (DORA_SHORTCUTS[id].keys as string)
  }

  return (
    <ShortcutContext.Provider value={{ builder: $, results: results.current, register, getDisplay, getCombo, rebind, overrides: overrides.current as any }}>
      {children}
    </ShortcutContext.Provider>
  )
}

export function useShortcutContext() {
  const ctx = useContext(ShortcutContext)
  if (!ctx) throw new Error('useShortcutContext must be inside ShortcutProvider')
  return ctx
}
```

---

## 4. Per-Feature Registration Hook

**File:** `src/core/shortcuts/use-dora-shortcuts.ts`

```ts
import { useEffect } from 'react'
import { useShortcutContext } from './shortcut-registry'
import type { DoraShortcutId } from './shortcut-map'

type HandlerMap = Partial<Record<DoraShortcutId, () => void>>

export function useDoraShortcuts(handlers: HandlerMap) {
  const { register } = useShortcutContext()

  useEffect(() => {
    const bindings = Object.entries(handlers).map(([id, handler]) =>
      register(id as DoraShortcutId, handler!)
    )
    return () => bindings.forEach(b => b.unbind())
  }, [])  // handlers intentionally stable (pass refs or useCallback)
}
```

**Usage in SQL Console:**
```tsx
function SqlConsole() {
  useActiveScope(SCOPES.SQL_CONSOLE)
  useDoraShortcuts({
    'query.run': () => runQuery(),
    'query.format': () => formatQuery(),
    'editor.save-script': () => saveScript(),
  })
}
```

---

## 5. Persistence Layer

**File:** `src/core/shortcuts/shortcut-store.ts`

Overrides stored in Tauri SQLite (`get_setting`/`set_setting` — already exist).  
Falls back to `localStorage` on web.

```ts
import { commands } from '@/lib/bindings'

const STORAGE_KEY = 'shortcut_overrides'

type OverrideMap = Record<string, string>  // id → combo string

export function loadShortcutOverrides(): OverrideMap {
  try {
    // Tauri: loaded async, but we need sync at init — use cached value
    const cached = localStorage.getItem(STORAGE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

export async function saveShortcutOverride(id: string, combo: string): Promise<void> {
  const current = loadShortcutOverrides()
  const updated = { ...current, [id]: combo }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

  // Persist to Tauri SQLite if available
  if (window.__TAURI__) {
    await commands.setSetting(STORAGE_KEY, JSON.stringify(updated))
  }
}

export async function resetShortcutOverride(id: string): Promise<void> {
  const current = loadShortcutOverrides()
  const { [id]: _, ...rest } = current
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  if (window.__TAURI__) {
    await commands.setSetting(STORAGE_KEY, JSON.stringify(rest))
  }
}

export async function resetAllShortcuts(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY)
  if (window.__TAURI__) {
    await commands.setSetting(STORAGE_KEY, '{}')
  }
}
```

---

## 6. Settings UI — Keyboard Shortcuts Panel

**File:** `src/features/settings/components/keyboard-shortcuts-panel.tsx`

```tsx
import { useState, useCallback } from 'react'
import { useShortcutContext } from '@/core/shortcuts/shortcut-registry'
import { DORA_SHORTCUTS, SHORTCUT_CATEGORIES, type DoraShortcutId } from '@/core/shortcuts/shortcut-map'
import { resetAllShortcuts } from '@/core/shortcuts/shortcut-store'
import { ShortcutRow } from './shortcut-row'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'

export function KeyboardShortcutsPanel() {
  const { getDisplay, getCombo, overrides } = useShortcutContext()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = Object.entries(SHORTCUT_CATEGORIES).flatMap(([category, ids]) =>
    ids
      .filter(id => {
        if (activeCategory && category !== activeCategory) return false
        const entry = DORA_SHORTCUTS[id]
        const q = search.toLowerCase()
        return !q
          || (entry.options?.description ?? '').toLowerCase().includes(q)
          || getCombo(id).toLowerCase().includes(q)
          || id.toLowerCase().includes(q)
      })
      .map(id => ({ id, category }))
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Keyboard Shortcuts
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => resetAllShortcuts().then(() => window.location.reload())}
        >
          Reset all
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {[null, ...Object.keys(SHORTCUT_CATEGORIES)].map(cat => (
          <button
            key={cat ?? 'all'}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {cat ?? 'All'}
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Search shortcuts..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-sm"
      />

      {/* Rows grouped by category */}
      <div className="flex flex-col">
        {Object.keys(SHORTCUT_CATEGORIES)
          .filter(cat => !activeCategory || cat === activeCategory)
          .map(cat => {
            const rows = filtered.filter(r => r.category === cat)
            if (!rows.length) return null
            return (
              <div key={cat} className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-1 px-1">{cat}</div>
                <div className="rounded-md border border-border divide-y divide-border">
                  {rows.map(({ id }) => (
                    <ShortcutRow
                      key={id}
                      id={id as DoraShortcutId}
                      description={DORA_SHORTCUTS[id as DoraShortcutId].options?.description ?? id}
                      combo={getCombo(id as DoraShortcutId)}
                      display={getDisplay(id as DoraShortcutId)}
                      isOverridden={id in overrides}
                    />
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
```

---

## 7. Shortcut Row — Record & Rebind

**File:** `src/features/settings/components/shortcut-row.tsx`

Uses `$.record()` from the library for live key capture.

```tsx
import { useState } from 'react'
import { useShortcutContext } from '@/core/shortcuts/shortcut-registry'
import { resetShortcutOverride } from '@/core/shortcuts/shortcut-store'
import { formatShortcut } from '@remcostoeten/use-shortcut'
import type { DoraShortcutId } from '@/core/shortcuts/shortcut-map'
import { KbdBadge } from './kbd-badge'
import { Button } from '@/shared/ui/button'
import { RotateCcw, Keyboard } from 'lucide-react'

type Props = {
  id: DoraShortcutId
  description: string
  combo: string
  display: string
  isOverridden: boolean
}

type RecordState = 'idle' | 'recording' | 'conflict'

export function ShortcutRow({ id, description, combo, display, isOverridden }: Props) {
  const { builder, rebind } = useShortcutContext()
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [pendingCombo, setPendingCombo] = useState<string | null>(null)

  async function startRecording() {
    setRecordState('recording')
    try {
      const recorded = await builder.record({ timeoutMs: 5000 })
      setPendingCombo(recorded)
      setRecordState('idle')
      rebind(id, recorded)
    } catch {
      setRecordState('idle')  // Timeout or cancelled
    }
  }

  function handleReset() {
    resetShortcutOverride(id)
    rebind(id, null!)  // Pass null → reverts to default
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 group">
      {/* Label */}
      <span className="text-sm text-foreground">{description}</span>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Reset override */}
        {isOverridden && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleReset}
            title="Reset to default"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}

        {/* Binding display / recording state */}
        {recordState === 'recording' ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
            <Keyboard className="h-3.5 w-3.5" />
            Press keys…
          </div>
        ) : (
          <KbdBadge
            display={display}
            isOverridden={isOverridden}
            onClick={startRecording}
            title="Click to rebind"
          />
        )}
      </div>
    </div>
  )
}
```

---

## 8. KbdBadge — Display Component

**File:** `src/features/settings/components/kbd-badge.tsx`

Renders platform-aware modifier symbols (⌘, ⌃, ⇧, etc.).

```tsx
type Props = {
  display: string       // e.g. "⌘S" or "Ctrl+S" or "G then D"
  isOverridden?: boolean
  onClick?: () => void
  title?: string
}

export function KbdBadge({ display, isOverridden, onClick, title }: Props) {
  // Split on "then" for chord sequences
  const steps = display.split(' then ')

  return (
    <div
      className={cn(
        'flex items-center gap-1 cursor-pointer rounded px-1 py-0.5',
        'hover:bg-accent/50 transition-colors',
        isOverridden && 'ring-1 ring-primary/30'
      )}
      onClick={onClick}
      title={title}
    >
      {steps.map((step, i) => (
        <>
          {i > 0 && <span className="text-muted-foreground text-[10px] mx-0.5">then</span>}
          <kbd key={i} className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono',
            'bg-muted border border-border text-foreground',
            isOverridden && 'text-primary'
          )}>
            {step}
          </kbd>
        </>
      ))}
    </div>
  )
}
```

---

## 9. Command Palette Integration

Shortcut results expose `.display` — use it in the command palette so bindings stay in sync.

```tsx
// command-palette: show shortcut next to each command
import { useShortcutContext } from '@/core/shortcuts/shortcut-registry'

function CommandPaletteItem({ action }: { action: DoraShortcutId }) {
  const { getDisplay } = useShortcutContext()
  return (
    <div className="flex items-center justify-between">
      <span>{DORA_SHORTCUTS[action].options?.description}</span>
      <KbdBadge display={getDisplay(action)} />
    </div>
  )
}
```

---

## 10. Conflict Badge

**File:** `src/features/settings/components/shortcut-conflict-badge.tsx`

Library calls `onConflict` with `{ combo, existingCombo, reason: "exact" | "sequence-prefix" }`.

```tsx
type Props = { reason: 'exact' | 'sequence-prefix'; conflictsWith: string }

export function ShortcutConflictBadge({ reason, conflictsWith }: Props) {
  return (
    <span
      className="text-[10px] text-destructive border border-destructive/30 rounded px-1 py-0.5"
      title={`Conflicts with "${conflictsWith}" (${reason})`}
    >
      {reason === 'exact' ? '⚠ Duplicate' : '⚠ Prefix conflict'}
    </span>
  )
}
```

Wire into `ShortcutProvider` — store conflicts in state, expose via context, render in `ShortcutRow`.

---

## 11. Wire Into App

**File:** `src/App.tsx`

```tsx
import { ShortcutProvider } from '@/core/shortcuts/shortcut-registry'

export function App() {
  return (
    <ShortcutProvider>
      {/* rest of app */}
    </ShortcutProvider>
  )
}
```

Settings panel mounts `<KeyboardShortcutsPanel />` inside existing settings modal.

---

## 12. Backend Integration

No new backend commands needed. Uses existing:
- `get_setting(key)` / `set_setting(key, value)` — persisting overrides to SQLite
- Key: `"shortcut_overrides"` → JSON string of `Record<DoraShortcutId, combo>`

Tauri command already registered in `lib.rs`:
```
database::commands::get_setting
database::commands::set_setting
```

---

## Checklist

- [ ] Install: `bun add @remcostoeten/use-shortcut`
- [ ] Create `src/core/shortcuts/` directory + 5 files above
- [ ] Wrap `<App>` with `<ShortcutProvider>`
- [ ] Migrate scattered `useShortcut()` calls (if any) to `useDoraShortcuts()`
- [ ] Add `useActiveScope()` to SqlConsole, DatabaseStudio, DrizzleRunner, CommandPalette
- [ ] Build `KeyboardShortcutsPanel` + `ShortcutRow` + `KbdBadge`
- [ ] Mount panel in settings modal (Settings → Keyboard Shortcuts tab)
- [ ] Show `display` strings in command palette items
- [ ] Conflict detection: bubble `onConflict` events to UI
- [ ] Recording: `builder.record()` called from `ShortcutRow` click
- [ ] Persist overrides via `shortcut-store.ts` (localStorage + Tauri SQLite)
- [ ] Test chord sequences: `g d`, `g s`, `g c`
- [ ] Test scope activation: SQL Console shortcuts inactive in Studio and vice versa
- [ ] Platform check: `⌘` on Mac, `Ctrl` on Windows/Linux

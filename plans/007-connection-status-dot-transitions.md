# 007 — Mark connection status transitions on the tab-bar dot

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM
- **Category**: Missed opportunities (state indication) + Cohesion (dead CSS)
- **Estimated scope**: 1 file edited, ~35 lines (styles.css already has the keyframes)

## Problem

The connection tab-bar's status dot is the most visible state signal in the app and it changes color in a single frame:

```tsx
// packages/studio/src/features/connection-tab-bar/connection-tab-bar.tsx:102-105 — current
<span
  aria-hidden="true"
  className={cn('h-2 w-2 shrink-0 rounded-full', statusColor(connection.status))}
/>
```

`statusColor` (`connection-tab-bar.tsx:33-44`) returns `bg-green-500` / `bg-red-500` / `bg-amber-500`; there is no `transition-colors`, no pulse.

Meanwhile `styles.css` carries purpose-built one-shot animations that **nothing references** (repo-wide grep confirms zero TSX hits):

```css
/* packages/studio/src/styles.css:769-808 — current, dead */
.connection-status-success {
	animation: statusPulse 0.6s ease-out;
}

.connection-status-error {
	animation: statusShake 0.4s ease-out;
}
/* statusPulse: scale 0.95 → 1.02 → 1, opacity 0 → 1 (:777-791) */
/* statusShake: translateX 0 / ±4px, four beats (:793-808) */
```

## Target

- The dot always carries `transition-colors duration-300 ease-[var(--ease-out)]` so idle↔connected↔error color changes ease over 300ms.
- On the **transition edge** into `connected`, the dot plays `statusPulse` once (0.6s); into `error`, `statusShake` once (0.4s). Never on initial render, never re-triggered by re-renders — only when the status value actually changes.
- Reduced motion: the shake is suppressed by plan 001's media block (`.connection-status-error { animation: none }`); the color transition and the sub-pixel pulse stay.

## Repo conventions to follow

- Easing token in class form: `ease-[var(--ease-out)]` (`--ease-out` defined at `styles.css:182`) — exemplar: `packages/studio/src/features/connections/components/connection-switcher.tsx:217`.
- This file (`connection-tab-bar.tsx`) uses 2-space indentation and double-quoted JSX attributes — unlike most of the package. Match this file, not the others.
- Standalone functions are `function` declarations; callbacks are function expressions.

## Steps

All edits in `packages/studio/src/features/connection-tab-bar/connection-tab-bar.tsx`.

1. Extend the react import at `:1`: `import { useEffect, useRef, useState, type ReactNode } from 'react'`.

2. Below `statusLabel` (`:46-55`), add a `StatusDot` component with edge detection:

```tsx
function StatusDot({ status }: { status: Connection['status'] }) {
  const prevStatusRef = useRef(status)
  const [flash, setFlash] = useState<'success' | 'error' | null>(null)

  useEffect(
    function flashOnTransition() {
      if (prevStatusRef.current === status) return
      prevStatusRef.current = status
      if (status === 'connected') setFlash('success')
      else if (status === 'error') setFlash('error')
      else setFlash(null)
    },
    [status]
  )

  return (
    <span
      aria-hidden="true"
      onAnimationEnd={function clearFlash() {
        setFlash(null)
      }}
      className={cn(
        'h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ease-[var(--ease-out)]',
        statusColor(status),
        flash === 'success' && 'connection-status-success',
        flash === 'error' && 'connection-status-error'
      )}
    />
  )
}
```

3. Replace the `<span>` at `:102-105` with:

```tsx
<StatusDot status={connection.status} />
```

## Boundaries

- Do NOT edit `styles.css` — the keyframes and classes exist and are correct as-is (plan 001 handles their reduced-motion story).
- Do NOT animate the tab itself, the label, or `statusLabel`.
- Do NOT touch the secondary status surface in `connection-switcher.tsx` (`:472-510`) — out of scope for this plan.
- Do NOT revive `.query-tab--executing` (`styles.css:1034`) — it is separate dead CSS; the query tab bar deliberately uses a spinner.
- Do NOT add new dependencies.
- If the span at `:102-105` has drifted, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio at `localhost:1420`, ideally with the docker databases from `docker-compose.databases.yml`):
  - Open a connection: when the dot goes amber → green, the color eases over ~300ms and the dot plays one small scale pulse (0.6s), then rests. It must not pulse again on unrelated re-renders (switch tables, type in the SQL console — the dot stays still).
  - Stop the database container (`docker compose -f docker-compose.databases.yml stop postgres`): when the status flips to error, the dot shakes once (±4px, 0.4s) and settles red.
  - On app launch with an already-connected database, the dot renders green with **no** pulse (initial render is not a transition).
  - Note: `statusPulse` starts at `opacity: 0` — in slow motion the dot blinks out then pops in as part of the pulse; confirm at full speed this reads as a single "pop", not a flicker. If it reads as flicker, report it (the fix would be editing the keyframe, which is out of scope here).
  - Emulate `prefers-reduced-motion: reduce` (requires plan 001): error produces only the color ease, no shake.
- **Done when**: status changes are never a single-frame color swap, transitions fire exactly once per actual status change, and idle renders never animate.

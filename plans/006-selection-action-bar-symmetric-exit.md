# 006 — Give the selection action bar a symmetric exit

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM
- **Category**: Interruptibility / physicality (asymmetric enter–exit paths)
- **Estimated scope**: 2 files, ~30 lines

## Problem

The selection action bar slides in gracefully and vanishes in one frame. Enter is CSS keyframes on the container classes:

```tsx
// packages/studio/src/features/database-studio/components/selection-action-bar.tsx:277-288 — current
const floatingClasses = [
	'absolute bottom-10 inset-x-0 mx-auto w-fit max-w-[calc(100%-2rem)] z-[100]',
	'flex items-center gap-1 pl-3 pr-2 py-1.5',
	'bg-popover/90 backdrop-blur-xl border border-border/60 rounded-2xl',
	'shadow-[0_8px_30px_rgba(0,0,0,0.12)]',
	'animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out'
]

const staticClasses = [
	'flex items-center gap-2 h-11 px-3 bg-sidebar/80 backdrop-blur-sm border-t border-sidebar-border shrink-0',
	'animate-in slide-in-from-bottom-2 duration-200'
]
```

…but the component is a framer `motion.div` (`selection-action-bar.tsx:360-362`, with `layout` + `LAYOUT_SPRING` from `:60-65`) whose mount is gated in the parent with plain conditionals and **no `AnimatePresence`**, so unmount is instant:

```tsx
// packages/studio/src/features/database-studio/database-studio.tsx:1194 — current (static bar)
rowsForActions.size > 0 && (
	<SelectionActionBar ... mode='static' />
)}

// packages/studio/src/features/database-studio/database-studio.tsx:1229 — current (floating bar)
{tableData && settings.selectionBarStyle === 'floating' && rowsForActions.size > 0 && (
	<SelectionActionBar ... mode='floating' />
)}
```

Dismissable surfaces must exit the way they entered. Framer-motion (`AnimatePresence`, `motion`) is already imported in `selection-action-bar.tsx:15`.

## Target

Enter and exit both live in framer (the CSS `animate-in` classes are removed so the two systems don't double-animate):

- Enter: `opacity 0 → 1`, `y 16 → 0` (floating) / `y 8 → 0` (static), duration **0.3s** (floating) / **0.2s** (static), ease **`[0.23, 1, 0.32, 1]`** (the repo's `--ease-out` as an array)
- Exit: `opacity 1 → 0`, `y 0 → 8`, duration **0.15s**, same ease — exits faster than it enters
- `layout` animation keeps `LAYOUT_SPRING` unchanged
- Reduced motion: `y` offsets become 0 (opacity only), via framer's `useReducedMotion()`

## Repo conventions to follow

- Framer easing arrays mirror the CSS token — exemplar: `packages/studio/src/features/connections/components/connection-dialog.tsx:957` defines `EASE_OUT = [0.23, 1, 0.32, 1]` matching `--ease-out` in `styles.css:182`.
- `useReducedMotion()` gating — exemplar: `connection-dialog.tsx:978`.
- Named function expressions for callbacks; tab indentation.

## Steps

1. In `packages/studio/src/features/database-studio/components/selection-action-bar.tsx`:
   - Add `useReducedMotion` to the framer import at `:15`.
   - Near `LAYOUT_SPRING` (`:60-65`), add:

```tsx
const EASE_OUT = [0.23, 1, 0.32, 1] as const
```

   - Delete the line `'animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out'` from `floatingClasses` (`:282`) and the line `'animate-in slide-in-from-bottom-2 duration-200'` from `staticClasses` (`:287`).
   - Inside the component (with the other hooks), add `const reduceMotion = useReducedMotion()`.
   - On the root `motion.div` (`:360-362`), replace `transition={LAYOUT_SPRING}` with enter/exit props:

```tsx
<motion.div
	layout
	initial={{ opacity: 0, y: reduceMotion ? 0 : isFloating ? 16 : 8 }}
	animate={{ opacity: 1, y: 0 }}
	exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
	transition={{
		duration: isFloating ? 0.3 : 0.2,
		ease: EASE_OUT,
		exit: { duration: 0.15, ease: EASE_OUT },
		layout: LAYOUT_SPRING
	}}
```

   Note: `isFloating` is defined at `:290`; if it is declared after the point where these props need it, hoist `const isFloating = mode === 'floating'` above the class arrays — it has no other dependencies.
   If the installed framer-motion version rejects a nested `exit` key inside `transition`, put the exit timing on the exit target instead: `exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: { duration: 0.15, ease: EASE_OUT } }}` and drop the `exit` key from `transition`.

2. In `packages/studio/src/features/database-studio/database-studio.tsx`:
   - Add `import { AnimatePresence } from 'framer-motion'` (framer is already in this chunk via `SelectionActionBar`).
   - Wrap the static-bar conditional (`:1194-1211`) in `<AnimatePresence>…</AnimatePresence>`.
   - Wrap the floating-bar conditional (`:1229-1246`) in its own `<AnimatePresence>…</AnimatePresence>`.

## Boundaries

- Do NOT change `LAYOUT_SPRING`, the overflow expand/collapse logic, or the internal `AnimatePresence mode='popLayout'` chip list already inside the component.
- Do NOT touch keyboard handling, focus management, or the action buttons.
- Do NOT restyle either mode — only the two `animate-in` lines are removed from the class arrays.
- Do NOT add new dependencies.
- If the class arrays or the motion.div at the cited lines have drifted, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio at `localhost:1420`, select rows in a table; test both selection-bar styles in Settings):
  - Select a row: the bar rises and fades in (0.3s floating / 0.2s static).
  - Press Escape / clear the selection: the bar drops and fades out in ~0.15s — visibly quicker than it entered, along the same downward path. It must never vanish in one frame.
  - Select → clear → select rapidly: no double-play, no flicker, no bar stuck half-visible.
  - The width morph when selecting more rows (layout spring) still behaves exactly as before.
  - Emulate `prefers-reduced-motion: reduce`: the bar fades in/out with no vertical travel.
- **Done when**: both modes enter and exit along the same bottom edge with the exit at half the enter duration, and the pre-existing layout spring is untouched.

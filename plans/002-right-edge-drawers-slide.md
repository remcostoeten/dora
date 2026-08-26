# 002 — Slide the right-edge drawers instead of teleporting them

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: HIGH
- **Category**: Missed opportunities (spatial consistency / preventing a jarring change)
- **Estimated scope**: 4 files (1 new hook, 3 edited components)

## Problem

Two large fixed drawers mount and unmount in a single frame — a 384px and a 420px surface with heavy shadows appearing/vanishing with no bridge:

```tsx
// packages/studio/src/features/database-studio/components/row-detail-panel.tsx:11-15 — current
export function RowDetailPanel({ open, onClose, row, columns, tableName }: Props) {
	if (!open) return null

	return (
		<div className='fixed inset-y-0 right-0 w-96 bg-card border-l border-sidebar-border shadow-xl z-50 flex flex-col'>
```

```tsx
// packages/studio/src/features/ai-assistant/ai-assistant-panel.tsx:193, 208-213 — current
	if (!open) return null
	...
	return (
		<aside
			className={cn(
				'fixed right-0 top-9 z-40 flex h-[calc(100%-2.25rem)] w-[420px] max-w-[90vw] flex-col border-l border-sidebar-border bg-sidebar shadow-2xl'
			)}
		>
```

The AI panel's host also gates it (`packages/studio/src/pages/workspace/ai-assistant-host.tsx:75` — `if (!open) return null`), and the floating toggle button vanishes the same frame the panel appears (`ai-assistant-host.tsx:28` — `if (open) return null`).

Both drawers must **stay unmounted while closed** — the host's comment at `ai-assistant-host.tsx:42-47` documents that keeping the AI panel a leaf mounted only while open is a deliberate perf decision (its editor-context subscription updates on every keystroke). So the fix is enter/exit transitions around a briefly-delayed unmount, not keep-alive.

## Target

Both drawers slide from the right edge, symmetric paths, animating `transform` only:

- Enter: `translateX(100%)` → `translateX(0)`, **240ms `var(--ease-out)`** (`cubic-bezier(0.23, 1, 0.32, 1)`)
- Exit: `translateX(0)` → `translateX(100%)`, **200ms `var(--ease-out)`**, then unmount
- Reduced motion: opacity-only fade, 150ms, no translation
- The AI toggle button fades back in over 150ms when the panel closes

Mechanism: CSS transitions driven by a `data-state` attribute (transitions retarget mid-flight, so rapid open/close never jumps), plus a small presence hook that delays unmount for the exit duration and yields a one-frame `closed` state on mount so the enter transition has a from-state. `@starting-style` is deliberately avoided — the desktop app runs on WebKitGTK/WKWebView where its support is not guaranteed.

## Repo conventions to follow

- Easing tokens: `packages/studio/src/styles.css:182` defines `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. In Tailwind classes it is consumed as `ease-[var(--ease-out)]` — exemplar: `packages/studio/src/features/connections/components/connection-switcher.tsx:217` (`'transition-[opacity,transform,color] duration-150 ease-[var(--ease-out)]'`).
- Reduced-motion in class form uses Tailwind's built-in `motion-reduce:` variant.
- Code style: standalone functions are `function` declarations; callbacks are written as **named function expressions** (`useEffect(function syncPresence() {...})`) — exemplar: `packages/studio/src/pages/workspace/ai-assistant-host.tsx:22-27`. Single non-exported props types are named `Props`. Path alias is `@studio/...`. Tab indentation.
- Shared hooks live in `packages/studio/src/shared/hooks/` (existing: `use-stable-callback.ts`).

## Steps

1. Create `packages/studio/src/shared/hooks/use-presence.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

/**
 * Presence controller for enter/exit transitions on conditionally-rendered UI.
 * `present` keeps the element mounted for `exitMs` after `open` flips false.
 * `state` is 'closed' on the first mounted frame and flips to 'open' a frame
 * later, so a CSS transition has a from-state to animate away from.
 */
export function usePresence(open: boolean, exitMs: number) {
	const [present, setPresent] = useState(open)
	const [state, setState] = useState<'open' | 'closed'>('closed')
	const timeoutRef = useRef<number | undefined>(undefined)

	useEffect(
		function syncPresence() {
			if (open) {
				window.clearTimeout(timeoutRef.current)
				setPresent(true)
				/*
				 * Double rAF: the first frame can batch into the same paint as the
				 * mount, which would skip the transition. The second guarantees the
				 * 'closed' styles have been painted before flipping to 'open'.
				 */
				let inner: number | undefined
				const outer = window.requestAnimationFrame(function () {
					inner = window.requestAnimationFrame(function () {
						setState('open')
					})
				})
				return function () {
					window.cancelAnimationFrame(outer)
					if (inner !== undefined) window.cancelAnimationFrame(inner)
				}
			}
			setState('closed')
			timeoutRef.current = window.setTimeout(function () {
				setPresent(false)
			}, exitMs)
			return function () {
				window.clearTimeout(timeoutRef.current)
			}
		},
		[open, exitMs]
	)

	return { present, state }
}
```

2. In `packages/studio/src/features/database-studio/components/row-detail-panel.tsx`:
   - Add `import { usePresence } from '@studio/shared/hooks/use-presence'`.
   - Replace the gate at `:12`:

```tsx
	const { present, state } = usePresence(open, 200)
	if (!present) return null
```

   - Change the root div at `:15` to:

```tsx
		<div
			data-state={state}
			className='fixed inset-y-0 right-0 w-96 bg-card border-l border-sidebar-border shadow-xl z-50 flex flex-col transition-[transform,opacity] duration-200 data-[state=open]:duration-[240ms] ease-[var(--ease-out)] data-[state=closed]:translate-x-full motion-reduce:data-[state=closed]:translate-x-0 motion-reduce:data-[state=closed]:opacity-0 motion-reduce:duration-150'
		>
```

3. In `packages/studio/src/features/ai-assistant/ai-assistant-panel.tsx`:
   - Add the same `usePresence` import.
   - Replace `if (!open) return null` at `:193` with the same two lines as step 2 (`usePresence(open, 200)`, gate on `present`).
   - Add `data-state={state}` to the `<aside>` at `:209` and extend its `cn(...)` at `:210-212` with the same motion classes as step 2 (`transition-[transform,opacity] duration-200 data-[state=open]:duration-[240ms] ease-[var(--ease-out)] data-[state=closed]:translate-x-full motion-reduce:data-[state=closed]:translate-x-0 motion-reduce:data-[state=closed]:opacity-0 motion-reduce:duration-150`).

4. In `packages/studio/src/pages/workspace/ai-assistant-host.tsx`:
   - In `AiAssistantPanelHost`, replace `if (!open) return null` at `:75` with:

```tsx
	const { present } = usePresence(open, 200)
	...
	if (!present) return null
```

   (the `usePresence` call goes with the other hooks at the top of the function, before any early return; import as in step 2). This keeps the lazy subtree mounted for the 200ms exit.
   - In `AiAssistantToggle`, add an enter animation to the Button at `:30-38` so it fades back after the panel closes — append to its className: `animate-in fade-in duration-150`.

## Boundaries

- Do NOT keep either panel mounted while closed beyond the exit window — the mounted-only-while-open design at `ai-assistant-host.tsx:42-47` is deliberate.
- Do NOT add framer-motion to these files; CSS transitions only.
- Do NOT touch `row-detail-panel.tsx` content markup below the root div, or anything in `ai-assistant-panel.tsx` below the `<aside>` opening tag.
- Do NOT add new dependencies.
- If the code at the cited lines has drifted from the excerpts above, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio in browser at `localhost:1420`):
  - Open a row's details from the data grid: the panel slides in from the right edge in ~240ms and decelerates hard at the end; closing slides it back out the same edge, slightly faster.
  - Toggle the AI assistant rapidly: the drawer reverses smoothly mid-flight — it must never jump to fully-open or fully-closed between toggles (transitions retarget; if it snaps, the `data-state` wiring is wrong).
  - Close the AI panel: the sparkle FAB fades in ~150ms after, not in the same frame the panel starts leaving.
  - DevTools → Rendering → emulate `prefers-reduced-motion: reduce`: both drawers fade (no horizontal movement).
  - First-ever open of the AI panel goes through a Suspense fallback (lazy chunk); the slide plays once the real panel mounts — a brief skeleton before it is acceptable.
- **Done when**: neither drawer ever appears or disappears in a single frame, rapid toggling never glitches, and reduced motion falls back to fades.

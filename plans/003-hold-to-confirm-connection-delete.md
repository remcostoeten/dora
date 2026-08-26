# 003 — Hold-to-confirm the connection delete button

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM (doubles as a data-safety fix)
- **Category**: Missed opportunities (feedback / slip prevention)
- **Estimated scope**: 1 file (`connection-switcher.tsx`), ~60 lines

## Problem

Deleting a connection is a single un-confirmed click. The trash button in the connection switcher fires the delete immediately:

```tsx
// packages/studio/src/features/connections/components/connection-switcher.tsx:207-235 — current (abridged)
{onDeleteConnection && (
	<button
		data-connection-action
		type='button'
		className={cn(
			'flex h-6 w-6 items-center justify-center rounded-sm',
			'text-muted-foreground',
			'opacity-0 -translate-x-1 pointer-events-none',
			'group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:pointer-events-auto',
			'group-data-[highlighted]/row:opacity-100 group-data-[highlighted]/row:translate-x-0 group-data-[highlighted]/row:pointer-events-auto',
			'transition-[opacity,transform,color] duration-150 ease-[var(--ease-out)]',
			'hover:text-destructive hover:bg-background/60',
			'focus-visible:outline-hidden focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-destructive/40'
		)}
		onPointerDown={function (e) {
			onKeepOpenAfterDelete()
			e.preventDefault()
			e.stopPropagation()
		}}
		onClick={function (e) {
			e.preventDefault()
			e.stopPropagation()
			onConfirmDelete(connection.id)
		}}
		title={`Delete ${connection.name}`}
		aria-label={`Delete ${connection.name}`}
	>
		<Trash2 className='h-3 w-3' />
	</button>
)}
```

`onConfirmDelete` is not a confirmation — it routes to `confirmDelete` (`connection-switcher.tsx:329-333`), which fires `onDeleteConnection` straight through. There is no undo action on the success toast. A slip on a 24px icon destroys a connection.

## Target

The trash button becomes hold-to-confirm. A destructive fill sweeps across it while pressed; releasing early snaps the fill back; completing the hold fires the delete.

- Fill: an absolutely-positioned overlay revealed via `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`
- Hold: **2000ms `linear`** (deliberate phase — slow and even)
- Snap-back on early release: **200ms `var(--ease-out)`** (`cubic-bezier(0.23, 1, 0.32, 1)`) (system response — fast)
- Keyboard: holding Enter or Space works the same way (keydown starts, keyup cancels)
- Reduced motion: the fill is kept as-is — it *is* the progress information, not decoration

## Repo conventions to follow

- Easing token in class form: `ease-[var(--ease-out)]` (already used in this very className, `connection-switcher.tsx:217`).
- Callbacks are named function expressions (`onClick={function (e) {...}}`) — match the existing handlers in this file.
- Tailwind arbitrary properties for clip-path: `[clip-path:inset(0_100%_0_0)]` (underscores for spaces).
- Tab indentation.

## Steps

All edits are inside the memoized connection-row component in `packages/studio/src/features/connections/components/connection-switcher.tsx` (the component containing the excerpt above).

1. Add `useState` to the existing React imports of the file if not already imported.

2. Inside the row component, add hold state:

```tsx
	const [isHolding, setIsHolding] = useState(false)
```

3. Replace the delete `<button>` block (`:207-236`) with:

```tsx
{onDeleteConnection && (
	<button
		data-connection-action
		type='button'
		className={cn(
			'relative overflow-hidden flex h-6 w-6 items-center justify-center rounded-sm',
			'text-muted-foreground',
			'opacity-0 -translate-x-1 pointer-events-none',
			'group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:pointer-events-auto',
			'group-data-[highlighted]/row:opacity-100 group-data-[highlighted]/row:translate-x-0 group-data-[highlighted]/row:pointer-events-auto',
			'transition-[opacity,transform,color] duration-150 ease-[var(--ease-out)]',
			'hover:text-destructive hover:bg-background/60',
			isHolding && 'text-destructive-foreground',
			'focus-visible:outline-hidden focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-destructive/40'
		)}
		onPointerDown={function (e) {
			onKeepOpenAfterDelete()
			e.preventDefault()
			e.stopPropagation()
			e.currentTarget.setPointerCapture(e.pointerId)
			setIsHolding(true)
		}}
		onPointerUp={function () {
			setIsHolding(false)
		}}
		onPointerCancel={function () {
			setIsHolding(false)
		}}
		onKeyDown={function (e) {
			if (e.key !== 'Enter' && e.key !== ' ') return
			e.preventDefault()
			e.stopPropagation()
			if (!isHolding) {
				onKeepOpenAfterDelete()
				setIsHolding(true)
			}
		}}
		onKeyUp={function (e) {
			if (e.key === 'Enter' || e.key === ' ') setIsHolding(false)
		}}
		onBlur={function () {
			setIsHolding(false)
		}}
		onClick={function (e) {
			e.preventDefault()
			e.stopPropagation()
		}}
		title={`Hold to delete ${connection.name}`}
		aria-label={`Hold to delete ${connection.name}`}
	>
		<span
			aria-hidden='true'
			className={cn(
				'pointer-events-none absolute inset-0 bg-destructive',
				isHolding
					? '[clip-path:inset(0_0_0_0)] transition-[clip-path] duration-[2000ms] ease-linear'
					: '[clip-path:inset(0_100%_0_0)] transition-[clip-path] duration-200 ease-[var(--ease-out)]'
			)}
			onTransitionEnd={function (e) {
				if (e.propertyName !== 'clip-path') return
				if (!isHolding) return
				setIsHolding(false)
				onConfirmDelete(connection.id)
			}}
		/>
		<Trash2 className='relative h-3 w-3' />
	</button>
)}
```

Notes for the executor:
- `onClick` is kept but now only swallows the event — the delete fires exclusively from the fill's `onTransitionEnd`.
- `setPointerCapture` makes dragging off the button still deliver `pointerup`, so the hold cancels cleanly.
- The `Trash2` icon gets `relative` so it paints above the `absolute` overlay.
- `onKeepOpenAfterDelete()` stays on the press-start paths — it keeps the dropdown open across the delete, as before.

## Boundaries

- Do NOT change `confirmDelete` (`connection-switcher.tsx:329-333`) or `onDeleteConnection` plumbing.
- Do NOT touch the two other delete entry points — the context-menu item (`connection-switcher.tsx:668-682`) and the command palette (`packages/studio/src/features/command-palette/command-palette.tsx:~374`). They remain un-confirmed; routing them through an AlertDialog is a separate, non-motion fix worth filing.
- Do NOT touch the edit (pencil) button or any other part of the row.
- Do NOT weaken the hold: no shortening below 2000ms, no click-through fallback.
- If the button block at `:207-236` has drifted from the excerpt, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio at `localhost:1420`, with at least one throwaway connection):
  - Press and hold the trash button: a destructive fill sweeps left→right, evenly, over 2 seconds; on completion the connection is deleted and the dropdown stays open.
  - Press and release after ~1s: the fill snaps back in ~200ms with a hard deceleration — noticeably faster than it filled (asymmetric timing is the point).
  - A quick click deletes **nothing**.
  - Drag off the button mid-hold: the fill snaps back (pointer capture delivers the release).
  - Focus the button with the keyboard, hold Enter: same fill, same 2s confirm; tapping Enter deletes nothing.
  - DevTools slow-motion (Animations panel at 10%): the fill edge is a clean vertical line, the icon stays legible above it.
- **Done when**: no code path on this button deletes a connection in under 2 seconds of sustained intent, and an aborted hold always snaps back.

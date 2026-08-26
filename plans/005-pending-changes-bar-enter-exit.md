# 005 — Ease the pending-changes bar in and out

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM
- **Category**: Missed opportunities (state indication / preventing a jarring change)
- **Estimated scope**: 2 files, ~30 lines (depends on `use-presence.ts` from plan 002)

## Problem

The unsaved-changes bar is an in-flow bar at the bottom of the data grid. It mounts on the first cell edit and unmounts on apply/discard, hard-snapping the entire grid layout by its own height in one frame — in both directions:

```tsx
// packages/studio/src/features/database-studio/components/pending-changes-bar.tsx:14-23 — current
export function PendingChangesBar({ editCount, isApplying, onApply, onCancel, className }: Props) {
	if (editCount === 0) return null

	return (
		<div
			className={cn(
				'flex items-center justify-between gap-4 px-4 py-2 bg-primary/10 border-t border-primary/20',
				className
			)}
		>
```

```tsx
// packages/studio/src/features/database-studio/database-studio.tsx:1248-1255 — current mount site
{tableId && canEditRows && hasEdits(tableId) && (
	<PendingChangesBar
		editCount={getEditCount(tableId)}
		isApplying={isApplyingEdits}
		onApply={handleApplyPendingEdits}
		onCancel={handleDiscardPendingEdits}
	/>
)}
```

Because the bar occupies layout space, a transform-only slide would not help — the jarring part *is* the height change. The repo's own (dead, being revived in plan 004) accordion tokens animate height for exactly this case; here the modern equivalent is a `grid-template-rows: 0fr ↔ 1fr` transition.

## Target

- Enter: bar's row grows `0fr → 1fr` + fades `opacity 0 → 1`, **200ms `var(--ease-out)`** (`cubic-bezier(0.23, 1, 0.32, 1)`)
- Exit: the reverse, same 200ms, then unmount
- The edit count keeps its last non-zero value during the exit (so "Edited 0 cells" never flashes)
- Reduced motion: opacity-only (the height change snaps)
- Perf note: `grid-template-rows` is a layout animation — a deliberate, documented exception for one occasional-frequency bar, mirroring the height-animating collapsible tokens.

## Repo conventions to follow

- Easing token in class form: `ease-[var(--ease-out)]` — exemplar: `packages/studio/src/features/connections/components/connection-switcher.tsx:217`.
- `usePresence(open, exitMs)` from `packages/studio/src/shared/hooks/use-presence.ts` — created by plan 002. If it does not exist yet, create it first using the exact code in plan `002-right-edge-drawers-slide.md`, step 1.
- Named function expressions for callbacks; `type Props` naming; tab indentation.

## Steps

1. In `packages/studio/src/features/database-studio/database-studio.tsx:1248`, remove the `hasEdits(tableId)` condition so the bar component always renders when editing is possible:

```tsx
{tableId && canEditRows && (
	<PendingChangesBar
		editCount={getEditCount(tableId)}
		isApplying={isApplyingEdits}
		onApply={handleApplyPendingEdits}
		onCancel={handleDiscardPendingEdits}
	/>
)}
```

2. Rewrite `packages/studio/src/features/database-studio/components/pending-changes-bar.tsx` so the component owns its presence:

```tsx
import { useRef } from 'react'
import { Check, X, Edit3 } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Button } from '@studio/shared/ui/button'
import { usePresence } from '@studio/shared/hooks/use-presence'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	editCount: number
	isApplying?: boolean
	onApply: () => void
	onCancel: () => void
	className?: string
}

export function PendingChangesBar({ editCount, isApplying, onApply, onCancel, className }: Props) {
	const open = editCount > 0
	const { present, state } = usePresence(open, 200)
	const lastCountRef = useRef(editCount)
	if (editCount > 0) {
		lastCountRef.current = editCount
	}
	const displayCount = editCount > 0 ? editCount : lastCountRef.current

	if (!present) return null

	return (
		<div
			data-state={state}
			className='grid grid-rows-[0fr] opacity-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100 transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-[opacity]'
		>
			<div className='overflow-hidden'>
				<div
					className={cn(
						'flex items-center justify-between gap-4 px-4 py-2 bg-primary/10 border-t border-primary/20',
						className
					)}
				>
					{/* existing bar content, unchanged, with editCount replaced by displayCount */}
				</div>
			</div>
		</div>
	)
}
```

The inner bar content (`Edit3` icon, "Edited N cells", Discard/Apply buttons — current lines 24-52) is preserved verbatim except every `editCount` read in JSX becomes `displayCount`.

## Boundaries

- Do NOT animate `height` or `margin` directly — the `0fr/1fr` grid wrapper with an `overflow-hidden` inner div is the mechanism.
- Do NOT change the Apply/Discard buttons or their handlers.
- Do NOT make the bar `fixed`/overlay — it stays in flow.
- Do NOT add new dependencies.
- If `database-studio.tsx:1248` or the bar component has drifted from the excerpts, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio at `localhost:1420`, any editable table):
  - Double-click a cell, change a value, commit: the bar grows in from zero height over ~200ms while fading in; the grid above compresses smoothly rather than jumping.
  - Discard: the bar folds away over 200ms; during the fold the label still reads "Edited 1 cell" (or the last count) — never "Edited 0 cells".
  - Edit → discard → edit rapidly: the bar reverses mid-motion without jumping (CSS transitions retarget).
  - DevTools slow-motion at 10%: no one-frame flash of the full-height bar before the grow starts.
  - Emulate `prefers-reduced-motion: reduce`: the bar fades but the height change is instant.
- **Done when**: the grid's height never changes in a single frame when edits start or resolve, and the count never displays zero mid-exit.

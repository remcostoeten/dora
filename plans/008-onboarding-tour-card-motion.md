# 008 — Let the onboarding tour card enter, step, and leave with the spotlight

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: LOW (delight tier — first-run only)
- **Category**: Missed opportunities (delight / preventing a jarring change)
- **Estimated scope**: 1 file, ~25 lines (optionally depends on `use-presence.ts` from plan 002)

## Problem

The onboarding tour (first three launches only — `launch-state.ts`) has a spotlight ring that glides smoothly between steps (`onboarding-tour.tsx:112`, `transition-all duration-200`), but the card it belongs to is inert: it pops in with no entrance, its text swaps instantly under the moving ring on every step, and Skip/Done removes everything in one frame:

```tsx
// packages/studio/src/features/onboarding/onboarding-tour.tsx:105, 121-133 — current
	if (!open || !step) return null
	...
	<div
		role='dialog'
		aria-label='Onboarding tour'
		className={cn(
			'fixed bottom-6 left-1/2 z-[91] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2',
			'rounded-lg border border-border bg-popover p-4 shadow-xl'
		)}
	>
		<div className='mb-1 flex items-center justify-between'>
			<div className='text-sm font-medium text-popover-foreground'>{step.title}</div>
			<div className='text-xs text-muted-foreground'>{progressLabel}</div>
		</div>
		<p className='mb-3 text-xs leading-relaxed text-muted-foreground'>{step.description}</p>
```

This is a rare, first-time surface — exactly where the delight budget lives.

## Target

- Card enter (once, on tour start): `opacity 0 → 1` + `scale 0.95 → 1` + a small rise, **200ms** — tw-animate `animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200`
- Step change: the title/description block fades and rises in over **150ms** (`animate-in fade-in slide-in-from-bottom-1 duration-150`) so the text travels with the gliding ring instead of teleporting
- Exit (Skip/Done): card and ring fade out over **150ms `var(--ease-out)`**, then unmount
- Reduced motion: fades only — `motion-reduce:zoom-in-100 motion-reduce:slide-in-from-bottom-0` on the enter, and the exit is already opacity-only

**Transform-collision warning**: tw-animate's enter keyframes write the full `transform`, which would clobber the card's `-translate-x-1/2` centering during the animation and make it jump sideways at the end. The centering must move to an outer wrapper before the card can use `animate-in`.

## Repo conventions to follow

- tw-animate-css enter utilities — exemplar: `packages/studio/src/shared/ui/dialog.tsx:37` (`fade-in-0` + `zoom-in-95` + `duration-200`).
- Easing token in class form: `ease-[var(--ease-out)]` (`styles.css:182`).
- `usePresence(open, exitMs)` from `packages/studio/src/shared/hooks/use-presence.ts` — created by plan 002; if absent, create it first from plan `002-right-edge-drawers-slide.md`, step 1.
- Named function expressions for callbacks; tab indentation.

## Steps

All edits in `packages/studio/src/features/onboarding/onboarding-tour.tsx`.

1. Add `import { usePresence } from '@studio/shared/hooks/use-presence'`, then replace the gate at `:105`:

```tsx
	const { present, state } = usePresence(open, 150)

	if (!present || !step) return null
```

(The `usePresence` call must sit with the other hooks at the top of the component, before any early return.)

2. Give the spotlight ring the shared exit fade — extend the className at `:112` with `transition-all` already present, so only add the state classes: append `opacity-100 data-[state=closed]:opacity-0` and add `data-state={state}` to the ring's div. Its existing `transition-all duration-200` covers the opacity.

3. Restructure the card (`:121-128`) into a centering wrapper + animated card:

```tsx
			<div
				data-state={state}
				className='fixed bottom-6 left-1/2 z-[91] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 transition-opacity duration-150 ease-[var(--ease-out)] data-[state=closed]:opacity-0'
			>
				<div
					role='dialog'
					aria-label='Onboarding tour'
					className={cn(
						'rounded-lg border border-border bg-popover p-4 shadow-xl',
						'animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200',
						'motion-reduce:zoom-in-100 motion-reduce:slide-in-from-bottom-0'
					)}
				>
```

(The `role`/`aria-label` move inward with the visual card; all children stay inside the inner div; both closing tags added at the bottom.)

4. Wrap the step text block (`:129-133` — the title/progress row and the description paragraph) in a keyed div so each step's text animates in:

```tsx
					<div key={stepIndex} className='animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:slide-in-from-bottom-0'>
						<div className='mb-1 flex items-center justify-between'>
							<div className='text-sm font-medium text-popover-foreground'>{step.title}</div>
							<div className='text-xs text-muted-foreground'>{progressLabel}</div>
						</div>
						<p className='mb-3 text-xs leading-relaxed text-muted-foreground'>{step.description}</p>
					</div>
```

The button row (`:134-165`) stays **outside** this keyed div — remounting it would drop keyboard focus from the Next button mid-tour.

## Boundaries

- Do NOT touch `launch-state.ts` or the tour-gating logic.
- Do NOT animate the buttons or the button row.
- Do NOT slow anything past the stated durations — this is a card the user reads, not a showpiece.
- Do NOT add framer-motion here.
- If the component has drifted from the excerpts, STOP and report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `bun run test` passes.
- **Feel check** (Studio at `localhost:1420`; clear the tour's localStorage keys so it shows again — see `features/onboarding/launch-state.ts` for the key names):
  - Tour start: the card fades/scales up from 95% in ~200ms, settling at its exact centered position — watch the last frames in slow motion for any horizontal jump (that's the transform collision; means step 3's wrapper split was botched).
  - Click Next: the ring glides AND the text block fades/rises in 150ms — the two now read as one movement. Focus stays on the Next button (press Enter repeatedly to confirm you can keyboard through the whole tour).
  - Skip: ring and card fade out together in ~150ms.
  - Emulate `prefers-reduced-motion: reduce`: pure fades, no scale or rise.
- **Done when**: nothing in the tour appears, changes, or disappears in a single frame, and keyboard focus survives every step change.

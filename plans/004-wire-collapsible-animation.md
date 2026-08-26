# 004 — Wire the dead accordion keyframes into CollapsibleContent

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM
- **Category**: Missed opportunities (preventing a jarring change) + Cohesion (dead tokens)
- **Estimated scope**: 4 files, ~25 lines

## Problem

`styles.css` defines accordion animation tokens that nothing in the repo references (repo-wide grep for `accordion-down|accordion-up|animate-accordion` hits only these lines):

```css
/* packages/studio/src/styles.css:103-124 — current (inside the @theme block) */
--animate-accordion-down: accordion-down 0.2s ease-out;
--animate-accordion-up: accordion-up 0.2s ease-out;

@keyframes accordion-down {
	from {
		height: 0;
	}

	to {
		height: var(--radix-accordion-content-height);
	}
}

@keyframes accordion-up {
	from {
		height: var(--radix-accordion-content-height);
	}

	to {
		height: 0;
	}
}
```

Meanwhile the shared Collapsible is a bare re-export, so every Radix collapsible in the app snaps open and shut:

```tsx
// packages/studio/src/shared/ui/collapsible.tsx:1-9 — current (entire file)
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

Consumers whose chevrons rotate over 200ms while their content teleports:
- `packages/studio/src/features/database-studio/components/data-file-help-panel.tsx:38` — `<CollapsibleContent className='pt-2'>` (chevron rotates at `:30-36`)
- `packages/studio/src/features/docker-manager/components/create-container-dialog.tsx:489` — `<CollapsibleContent className="space-y-4 pt-2">`

The keyframes also target the wrong Radix variable: Collapsible exposes `--radix-collapsible-content-height`, not `--radix-accordion-content-height`. There is no Accordion component in the repo.

## Target

- Rename the dead tokens to `collapsible-down` / `collapsible-up` and retarget them to `--radix-collapsible-content-height` (same `0.2s ease-out`).
- `CollapsibleContent` applies them via `data-state`, with reduced-motion opting out.
- Consumer `pt-2` padding moves off the animated element (padding on the height-animated element makes the animation start with an 8px jump — `box-sizing: border-box` can't compress padding below its own size).

## Repo conventions to follow

- Animation utility tokens live in the `@theme` block of `packages/studio/src/styles.css` (the `--animate-*` pattern at `:103-104` is itself the exemplar); Tailwind v4 turns `--animate-collapsible-down` into an `animate-collapsible-down` utility automatically.
- Radix wrapper style: thin `forwardRef` components merging classes with `cn` — exemplar: `packages/studio/src/shared/ui/dropdown-menu.tsx:49-69`.
- `cn` is imported from `@studio/shared/utils/cn`. Tab indentation. Named function expressions for the `forwardRef` callback.

## Steps

1. In `packages/studio/src/styles.css:103-124`, rename in place: `--animate-accordion-down` → `--animate-collapsible-down`, `--animate-accordion-up` → `--animate-collapsible-up`, `@keyframes accordion-down` → `@keyframes collapsible-down`, `@keyframes accordion-up` → `@keyframes collapsible-up`, and both occurrences of `var(--radix-accordion-content-height)` → `var(--radix-collapsible-content-height)`. Durations and easing stay `0.2s ease-out`.

2. Replace `packages/studio/src/shared/ui/collapsible.tsx` with:

```tsx
import { forwardRef } from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { cn } from '@studio/shared/utils/cn'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = forwardRef<
	React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
	React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(function CollapsibleContent({ className, ...props }, ref) {
	return (
		<CollapsiblePrimitive.CollapsibleContent
			ref={ref}
			className={cn(
				'overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none',
				className
			)}
			{...props}
		/>
	)
})

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

If the file lacks a `React` import for the type positions, add `import type * as React from 'react'`.

3. In `packages/studio/src/features/database-studio/components/data-file-help-panel.tsx:38-39`, move the padding inside: `<CollapsibleContent className='pt-2'>` → `<CollapsibleContent>`, and add `pt-2` to the `<ul>`'s className on the next line.

4. In `packages/studio/src/features/docker-manager/components/create-container-dialog.tsx:489`, change `<CollapsibleContent className="space-y-4 pt-2">` → `<CollapsibleContent><div className="space-y-4 pt-2"> … </div></CollapsibleContent>` (wrap the existing children in the div; spacing/padding move onto it).

## Boundaries

- Do NOT add animation to any consumer directly — only the shared wrapper animates.
- Do NOT touch the triggers or their chevron transitions (already correct at 200ms).
- Do NOT introduce an Accordion component or keep duplicate accordion tokens — the rename replaces them.
- Do NOT add new dependencies.
- If other `CollapsibleContent` consumers exist beyond the two above, leave their classNames untouched unless they also put padding on the content element — in that case apply the same padding-relocation pattern and note it in the report.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` passes. `grep -rn 'accordion' packages/studio/src` returns nothing.
- **Feel check** (Studio at `localhost:1420`):
  - Data-file view → "How data files work in Dora": content unfolds over 200ms in sync with the chevron rotation; collapsing folds it back up (Radix keeps the node mounted until the close animation ends — if content vanishes instantly on close, the `data-[state=closed]` class isn't applying).
  - The first visible pixel on expand is the top of the content, not an 8px blank strip (padding jump — means step 3/4 was missed).
  - Docker → create container → Advanced section behaves the same.
  - Emulate `prefers-reduced-motion: reduce`: sections snap open/closed with no animation.
- **Done when**: every Radix collapsible in the Studio unfolds/folds at 0.2s ease-out with no padding jump, and no `accordion-*` identifiers remain in the repo.

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

function TooltipProvider({
	delayDuration = 400,
	skipDelayDuration = 300,
	...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			delayDuration={delayDuration}
			skipDelayDuration={skipDelayDuration}
			{...props}
		/>
	)
}

const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

function finishOutgoingTooltips(incoming: HTMLElement) {
	const outgoing = document.querySelectorAll<HTMLElement>(
		'[data-slot="tooltip-content"][data-state="closed"]'
	)
	for (const node of outgoing) {
		if (node === incoming) continue
		// Finished rather than removed: Radix Presence only unmounts once the exit animation ends.
		for (const animation of node.getAnimations?.() ?? []) animation.finish()
	}
}

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 4, ...props }, forwardedRef) {
	const ref = React.useCallback(
		(node: HTMLDivElement | null) => {
			if (node?.dataset.state === 'instant-open') finishOutgoingTooltips(node)
			if (typeof forwardedRef === 'function') forwardedRef(node)
			else if (forwardedRef) forwardedRef.current = node
		},
		[forwardedRef]
	)

	return (
		<TooltipPrimitive.Content
			ref={ref}
			data-slot='tooltip-content'
			sideOffset={sideOffset}
			className={cn(
				'z-50 overflow-hidden rounded-md border border-sidebar-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md ease-[var(--ease-out)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:pointer-events-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=instant-open]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className
			)}
			style={{ transformOrigin: 'var(--radix-tooltip-content-transform-origin)' }}
			{...props}
		/>
	)
})

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

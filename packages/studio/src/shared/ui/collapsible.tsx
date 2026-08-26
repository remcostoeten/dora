import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { cn } from '@studio/shared/utils/cn'

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = React.forwardRef<
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

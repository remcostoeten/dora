import * as SwitchPrimitives from '@radix-ui/react-switch'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(function Switch({ className, ...props }, ref) {
	return (
		<SwitchPrimitives.Root
			className={cn(
				'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-150 data-[state=checked]:bg-white data-[state=unchecked]:bg-muted data-[state=checked]:focus-visible:bg-white/75 data-[state=unchecked]:focus-visible:bg-focus-strong disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
			ref={ref}
		>
			<SwitchPrimitives.Thumb
				className={cn(
					'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-background'
				)}
			/>
		</SwitchPrimitives.Root>
	)
})

export { Switch }

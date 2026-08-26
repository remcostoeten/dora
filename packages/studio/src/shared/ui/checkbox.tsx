import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
	return (
		<CheckboxPrimitive.Root
			ref={ref}
			className={cn(
				'peer h-4 w-4 shrink-0 rounded-sm border border-muted-foreground bg-background transition-colors duration-150 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:bg-focus-strong data-[state=checked]:focus-visible:bg-primary/75 disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn('flex items-center justify-center text-current')}
			>
				<Check className='h-3 w-3' />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	)
})

export { Checkbox }

import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(function Slider({ className, ...props }, ref) {
	return (
		<SliderPrimitive.Root
			ref={ref}
			className={cn(
				'group relative flex w-full touch-none select-none items-center',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Track className='relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted transition-colors duration-150 group-has-[:focus-visible]:bg-focus-strong'>
				<SliderPrimitive.Range className='absolute h-full bg-primary' />
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb className='block h-4 w-4 rounded-full border border-primary/50 bg-foreground shadow-sm transition-colors duration-150 focus-visible:bg-foreground/75 disabled:pointer-events-none disabled:opacity-50' />
		</SliderPrimitive.Root>
	)
})

export { Slider }

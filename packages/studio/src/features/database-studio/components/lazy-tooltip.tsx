import { useState, type ComponentProps, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'

type Props = {
	content: ReactNode
	side?: ComponentProps<typeof TooltipContent>['side']
	contentClassName?: string
	children: ReactNode
}

export function LazyTooltip({ content, side, contentClassName, children }: Props) {
	const [isArmed, setIsArmed] = useState(false)

	if (!isArmed) {
		return (
			<span className='contents' onPointerOver={() => setIsArmed(true)}>
				{children}
			</span>
		)
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} className={contentClassName}>
				{content}
			</TooltipContent>
		</Tooltip>
	)
}

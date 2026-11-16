import { PanelIcon } from '@studio/features/app-sidebar/rail-icons'
import { Button } from '@studio/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	isOpen?: boolean
	onToggle?: () => void
	className?: string
	buttonClassName?: string
	tooltip?: string
	tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

export function SidebarPanelToggle({
	isOpen = true,
	onToggle,
	className,
	buttonClassName,
	tooltip = 'Toggle sidebar (Ctrl+B)',
	tooltipSide = 'top'
}: Props) {
	if (!onToggle) return null

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant='ghost'
					size='icon'
					className={cn(
						'h-6 w-6 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent',
						buttonClassName
					)}
					onClick={onToggle}
					aria-label={tooltip}
					aria-pressed={isOpen}
				>
					<PanelIcon className={cn('h-4 w-4', className)} />
				</Button>
			</TooltipTrigger>
			<TooltipContent side={tooltipSide} className='text-xs'>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	)
}

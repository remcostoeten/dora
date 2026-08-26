import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@studio/shared/ui/collapsible'
import { cn } from '@studio/shared/utils/cn'
import { DATA_FILE_HELP_ITEMS } from '@studio/features/connections/data-file-health'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { useState } from 'react'

type Props = {
	className?: string
	defaultOpen?: boolean
}

export function DataFileHelpPanel({ className, defaultOpen = false }: Props) {
	const [open, setOpen] = useState(defaultOpen)

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className={cn('border-b border-border/60 bg-muted/20 px-4 py-2', className)}
		>
			<CollapsibleTrigger className='flex w-full items-center justify-between gap-2 text-left text-xs text-muted-foreground hover:text-foreground'>
				<span className='inline-flex items-center gap-1.5 font-medium'>
					<CircleHelp className='h-3.5 w-3.5' aria-hidden />
					How data files work in Dora
				</span>
				<ChevronDown
					className={cn(
						'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
						open && 'rotate-180'
					)}
					aria-hidden
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className='pt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground'>
					{DATA_FILE_HELP_ITEMS.map(function (item) {
						return (
							<li key={item} className='flex gap-2'>
								<span aria-hidden className='text-muted-foreground/70'>
									•
								</span>
								<span>{item}</span>
							</li>
						)
					})}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	)
}

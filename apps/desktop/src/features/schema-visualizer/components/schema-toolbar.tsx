import { useReactFlow } from '@xyflow/react'
import { Download, Maximize2, Map as MapIcon, RefreshCw, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/utils/cn'

type Props = {
	search: string
	onSearchChange: (v: string) => void
	showMinimap: boolean
	onToggleMinimap: () => void
	onRefresh: () => void
	onExportJson: () => void
	tableCount: number
	edgeCount: number
	isLoading: boolean
}

export function SchemaToolbar({
	search,
	onSearchChange,
	showMinimap,
	onToggleMinimap,
	onRefresh,
	onExportJson,
	tableCount,
	edgeCount,
	isLoading,
}: Props) {
	const { fitView } = useReactFlow()

	return (
		<div className='flex items-center justify-between gap-2 h-10 px-3 border-b border-sidebar-border bg-sidebar'>
			<div className='flex items-center gap-2 flex-1 min-w-0'>
				<div className='relative w-64'>
					<Input
						placeholder='Search tables...'
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className='h-7 text-xs pr-6'
					/>
					{search && (
						<button
							className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
							onClick={() => onSearchChange('')}
						>
							<X className='h-3 w-3' />
						</button>
					)}
				</div>
				<span className='text-[11px] text-muted-foreground whitespace-nowrap'>
					{tableCount} tables • {edgeCount} relationships
				</span>
			</div>

			<div className='flex items-center gap-1'>
				<Button
					variant='ghost'
					size='icon'
					className='h-7 w-7'
					title='Fit view'
					onClick={() => fitView({ padding: 0.2, duration: 300 })}
				>
					<Maximize2 className='h-3.5 w-3.5' />
				</Button>
				<Button
					variant='ghost'
					size='icon'
					className={cn('h-7 w-7', showMinimap && 'text-primary bg-sidebar-accent')}
					title='Toggle minimap'
					onClick={onToggleMinimap}
				>
					<MapIcon className='h-3.5 w-3.5' />
				</Button>
				<Button
					variant='ghost'
					size='icon'
					className='h-7 w-7'
					title='Export schema JSON'
					onClick={onExportJson}
					disabled={tableCount === 0}
				>
					<Download className='h-3.5 w-3.5' />
				</Button>
				<Button
					variant='ghost'
					size='icon'
					className='h-7 w-7'
					title='Refresh schema'
					onClick={onRefresh}
					disabled={isLoading}
				>
					<RefreshCw
						className={cn(
							'h-3.5 w-3.5',
							isLoading && 'animate-spin',
						)}
					/>
				</Button>
			</div>
		</div>
	)
}

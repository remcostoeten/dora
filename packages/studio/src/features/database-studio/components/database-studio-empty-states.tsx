import { Button } from '@studio/shared/ui/button'
import { Database, PanelLeft, Plus } from 'lucide-react'

type EmptyStateFrameProps = {
	onToggleSidebar?: () => void
	isSidebarOpen?: boolean
	children: React.ReactNode
}

function EmptyStateFrame({ onToggleSidebar, isSidebarOpen, children }: EmptyStateFrameProps) {
	return (
		<div className='flex flex-col h-full bg-background/50'>
			{onToggleSidebar && (
				<div className='flex items-center h-10 border-b border-sidebar-border bg-sidebar/50 shrink-0 px-3'>
					<Button
						variant='ghost'
						size='icon'
						className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
						onClick={onToggleSidebar}
						title='Toggle sidebar'
					>
						<PanelLeft
							className={`h-4 w-4 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`}
						/>
					</Button>
					<span className='ml-3 text-xs font-medium text-muted-foreground/70 tracking-wide uppercase'>
						Database Studio
					</span>
				</div>
			)}
			{children}
		</div>
	)
}

type NoConnectionProps = {
	onToggleSidebar?: () => void
	isSidebarOpen?: boolean
	onAddConnection?: () => void
}

export function DatabaseStudioNoConnection({
	onToggleSidebar,
	isSidebarOpen,
	onAddConnection
}: NoConnectionProps) {
	return (
		<EmptyStateFrame onToggleSidebar={onToggleSidebar} isSidebarOpen={isSidebarOpen}>
			<div className='flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300'>
				<div className='w-20 h-20 bg-sidebar-accent/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/50 shadow-sm backdrop-blur-sm'>
					<Database className='w-10 h-10 text-primary/60' strokeWidth={1.5} />
				</div>
				<h2 className='text-xl font-semibold mb-2 text-foreground tracking-tight'>
					No Database Connected
				</h2>
				<p className='text-muted-foreground text-center max-w-sm mb-8 leading-relaxed text-sm'>
					Select a connection from the sidebar to view its tables, or create a new
					connection to get started.
				</p>

				{onAddConnection && (
					<Button
						onClick={onAddConnection}
						className='gap-2 shadow-md hover:shadow-lg transition-all'
					>
						<Plus className='w-4 h-4' />
						Add Connection
					</Button>
				)}
			</div>
		</EmptyStateFrame>
	)
}

type NoTableProps = {
	onToggleSidebar?: () => void
	isSidebarOpen?: boolean
}

export function DatabaseStudioNoTable({ onToggleSidebar, isSidebarOpen }: NoTableProps) {
	return (
		<EmptyStateFrame onToggleSidebar={onToggleSidebar} isSidebarOpen={isSidebarOpen}>
			<div className='flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300'>
				<div className='w-20 h-20 bg-sidebar-accent/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/30'>
					<svg
						className='h-10 w-10 text-muted-foreground/50'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='1.5'
					>
						<rect x='3' y='3' width='18' height='18' rx='2' />
						<line x1='9' y1='3' x2='9' y2='21' />
					</svg>
				</div>
				<h1 className='text-xl font-semibold text-foreground mb-2 tracking-tight'>
					No Table Selected
				</h1>
				<p className='text-muted-foreground text-sm max-w-xs'>
					Select a table from the sidebar list to browse its records, structure, and
					relationships.
				</p>
			</div>
		</EmptyStateFrame>
	)
}

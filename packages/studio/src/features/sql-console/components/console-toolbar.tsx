import {
	PanelRight,
	Loader2,
	Sparkles,
	Play,
	Download,
	Braces,
	Filter,
	Clock,
	Bookmark,
	Database
} from 'lucide-react'

import { Button } from '@studio/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { cn } from '@studio/shared/utils/cn'

type Props = {
	onToggleRightSidebar: () => void
	showRightSidebar: boolean
	isExecuting: boolean
	mode: 'sql' | 'drizzle'
	onModeChange: (mode: 'sql' | 'drizzle') => void
	onRun?: () => void
	onPrettify?: () => void
	onExport?: () => void
	onExportCsv?: () => void
	hasResults?: boolean
	showJson?: boolean
	onShowJsonToggle?: () => void
	showFilter?: boolean
	onToggleFilter?: () => void
	showHistory?: boolean
	onToggleHistory?: () => void
	onSave?: () => void
	connectionName?: string
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<kbd
			className={cn(
				'pointer-events-none inline-flex h-4 min-w-4 select-none items-center justify-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/70 px-1 font-mono text-[10px] font-medium leading-none text-muted-foreground',
				className
			)}
		>
			{children}
		</kbd>
	)
}

type ToolbarIconButtonProps = {
	label: string
	active?: boolean
	disabled?: boolean
	onClick?: () => void
	children: React.ReactNode
}

function ToolbarIconButton({
	label,
	active,
	disabled,
	onClick,
	children
}: ToolbarIconButtonProps) {
	return (
		<Button
			variant='ghost'
			size='icon'
			className={cn(
				'h-8 w-8 rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
				'hover:bg-sidebar-accent hover:text-sidebar-foreground',
				active && 'bg-sidebar-accent text-sidebar-foreground',
				disabled && 'cursor-not-allowed opacity-45'
			)}
			onClick={onClick}
			disabled={disabled}
			title={label}
			aria-label={label}
		>
			{children}
		</Button>
	)
}

function ModeTab({
	active,
	children,
	shortcut,
	onClick
}: {
	active: boolean
	children: React.ReactNode
	shortcut: string
	onClick: () => void
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium',
				'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
				active
					? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
					: 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
			)}
		>
			<span>{children}</span>
			<Kbd className={cn(active && 'border-sidebar-border/80 bg-background/35 text-sidebar-foreground/70')}>
				{shortcut}
			</Kbd>
		</button>
	)
}

export function ConsoleToolbar({
	onToggleRightSidebar,
	showRightSidebar,
	isExecuting,
	mode,
	onModeChange,
	onRun,
	onPrettify,
	onExport,
	onExportCsv,
	hasResults,
	showJson,
	onShowJsonToggle,
	showFilter,
	onToggleFilter,
	showHistory,
	onToggleHistory,
	onSave,
	connectionName
}: Props) {
	return (
		<div className='flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-3 py-2'>
			<div className='flex min-w-0 items-center gap-3'>
				<div className='hidden min-w-0 items-center gap-2 rounded-md border border-sidebar-border/60 bg-sidebar-accent/35 px-2.5 py-1.5 text-xs text-muted-foreground lg:flex'>
					<Database className='h-3.5 w-3.5 shrink-0' />
					<span className='max-w-48 truncate font-medium text-sidebar-foreground'>
						{connectionName || 'No connection'}
					</span>
				</div>

				{onToggleHistory && (
					<ToolbarIconButton
						label='Toggle history panel'
						active={showHistory}
						onClick={onToggleHistory}
					>
						<Clock style={{ width: 16, height: 16 }} />
					</ToolbarIconButton>
				)}

				<div className='flex items-center gap-1 rounded-lg border border-sidebar-border/70 bg-background/25 p-1'>
					<ModeTab
						active={mode === 'sql'}
						onClick={() => onModeChange?.('sql')}
						shortcut='S'
					>
						SQL
					</ModeTab>
					<ModeTab
						active={mode === 'drizzle'}
						onClick={() => onModeChange?.('drizzle')}
						shortcut='D'
					>
						Drizzle
					</ModeTab>
				</div>
			</div>

			<div className='flex shrink-0 items-center gap-1.5'>
				{onSave && (
					<Button
						size='sm'
						variant='ghost'
						className='h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]'
						onClick={onSave}
						title='Save to Snippet Library'
					>
						<Bookmark className='h-3.5 w-3.5' />
						<span className='hidden md:inline'>Save</span>
						<Kbd className='ml-0.5 inline-flex'>⌘S</Kbd>
					</Button>
				)}

				<div className='mx-1 h-5 w-px bg-sidebar-border/70' />

				{onPrettify && (
					<ToolbarIconButton
						label='Format code (Shift+Alt+F)'
						onClick={onPrettify}
					>
						<Sparkles className='h-3.5 w-3.5' />
					</ToolbarIconButton>
				)}

				{onShowJsonToggle && (
					<ToolbarIconButton
						label='Toggle JSON view'
						active={showJson}
						onClick={onShowJsonToggle}
					>
						<Braces className='h-3.5 w-3.5' />
					</ToolbarIconButton>
				)}

				{onToggleFilter && (
					<ToolbarIconButton
						label='Toggle filter'
						active={showFilter}
						onClick={onToggleFilter}
					>
						<Filter className='h-3.5 w-3.5' />
					</ToolbarIconButton>
				)}

				{onExport && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<ToolbarIconButton
								label='Export results'
								disabled={!hasResults}
							>
								<Download className='h-3.5 w-3.5' />
							</ToolbarIconButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={onExport}>Export as JSON</DropdownMenuItem>
							<DropdownMenuItem onClick={onExportCsv}>Export as CSV</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				<div className='mx-1 h-5 w-px bg-sidebar-border/70' />

				{onRun && (
					<Button
						size='sm'
						variant='default'
						className={cn(
							'h-8 gap-2 rounded-md px-3 text-sm font-semibold shadow-sm',
							'transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97]',
							isExecuting
								? 'cursor-wait bg-muted text-muted-foreground'
								: 'bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90'
						)}
						onClick={onRun}
						disabled={isExecuting}
					>
						{isExecuting ? (
							<Loader2 className='h-3.5 w-3.5 animate-spin' />
						) : (
							<Play className='h-3.5 w-3.5 fill-current' />
						)}
						<span>{isExecuting ? 'Running' : 'Run'}</span>
						<Kbd className='inline-flex border-white/40 bg-black/40 text-white'>
							⌘↵
						</Kbd>
					</Button>
				)}

				<Button
					variant='ghost'
					size='sm'
					className={cn(
						'h-8 gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]',
						showRightSidebar && 'bg-sidebar-accent'
					)}
					onClick={onToggleRightSidebar}
					title='Toggle snippets'
				>
					<PanelRight
						className={cn(
							'h-3.5 w-3.5 transition-transform duration-200',
							showRightSidebar && 'rotate-180'
						)}
						style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
					/>
					<span className='hidden xl:inline'>Snippets</span>
				</Button>
			</div>
		</div>
	)
}

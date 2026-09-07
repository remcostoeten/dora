import { forwardRef } from 'react'
import {
	AlignLeft,
	PanelRight,
	Sparkles,
	Play,
	Square,
	Download,
	Braces,
	Filter,
	Clock,
	Bookmark,
	Database,
	BookOpen,
	Gauge
} from 'lucide-react'

import { Button } from '@studio/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { WindowControls } from '@studio/components/window-controls'
import { formatShortcut } from '@studio/core/shortcuts'

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
} & Omit<React.ComponentPropsWithoutRef<typeof Button>, 'children' | 'title'>

const ToolbarIconButton = forwardRef<HTMLButtonElement, ToolbarIconButtonProps>(
	function ToolbarIconButton(
		{ label, active, disabled, onClick, children, className, ...props },
		ref
	) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						ref={ref}
						variant='ghost'
						size='icon'
						className={cn(
							'h-8 w-8 rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
							'hover:bg-sidebar-accent hover:text-sidebar-foreground',
							active && 'bg-sidebar-accent text-sidebar-foreground',
							disabled && 'cursor-not-allowed opacity-45',
							className
						)}
						onClick={onClick}
						disabled={disabled}
						aria-label={label}
						{...props}
					>
						{children}
					</Button>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		)
	}
)

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
				'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
				'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]',
				active
					? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
					: 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
			)}
		>
			<span>{children}</span>
			<Kbd
				className={cn(
					active && 'border-sidebar-border/80 bg-background/35 text-sidebar-foreground/70'
				)}
			>
				{shortcut}
			</Kbd>
		</button>
	)
}

type HeaderProps = {
	mode: 'sql' | 'drizzle' | 'prisma'
	onModeChange: (mode: 'sql' | 'drizzle' | 'prisma') => void
	showHistory?: boolean
	onToggleHistory?: () => void
	connectionName?: string
}

export function ConsoleHeader({
	mode,
	onModeChange,
	showHistory,
	onToggleHistory,
	connectionName
}: HeaderProps) {
	return (
		<div
			className='flex h-10 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-3'
			data-tauri-drag-region='true'
		>
			<div className='flex min-w-0 items-center gap-2' data-tauri-drag-region='true'>
				<div className='hidden min-w-0 items-center gap-2 rounded-md border border-sidebar-border/60 bg-sidebar-accent/35 px-2.5 py-1 text-xs text-muted-foreground sm:flex'>
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

				<div className='flex items-center gap-1 rounded-lg border border-sidebar-border/70 bg-background/25 p-0.5'>
					<ModeTab
						active={mode === 'sql'}
						onClick={() => onModeChange?.('sql')}
						shortcut={formatShortcut('alt+s')}
					>
						SQL
					</ModeTab>
					<ModeTab
						active={mode === 'drizzle'}
						onClick={() => onModeChange?.('drizzle')}
						shortcut={formatShortcut('alt+d')}
					>
						Drizzle
					</ModeTab>
					<ModeTab
						active={mode === 'prisma'}
						onClick={() => onModeChange?.('prisma')}
						shortcut={formatShortcut('alt+p')}
					>
						Prisma
					</ModeTab>
				</div>
			</div>

			<WindowControls />
		</div>
	)
}

type ActionBarProps = {
	onToggleRightSidebar: () => void
	showRightSidebar: boolean
	isExecuting: boolean
	onRun?: () => void
	onCancel?: () => void
	onPrettify?: () => void
	onExport?: () => void
	onExportCsv?: () => void
	hasResults?: boolean
	showJson?: boolean
	onShowJsonToggle?: () => void
	showFilter?: boolean
	onToggleFilter?: () => void
	onSave?: () => void
	onAskAi?: () => void
	onExplainQuery?: () => void
	onExplainAnalyze?: () => void
}

export function EditorActionBar({
	onToggleRightSidebar,
	showRightSidebar,
	isExecuting,
	onRun,
	onCancel,
	onPrettify,
	onExport,
	onExportCsv,
	hasResults,
	showJson,
	onShowJsonToggle,
	showFilter,
	onToggleFilter,
	onSave,
	onAskAi,
	onExplainQuery,
	onExplainAnalyze
}: ActionBarProps) {
	return (
		<div className='flex h-9 shrink-0 items-center justify-between gap-2 border-t border-sidebar-border bg-sidebar px-2'>
			<div className='flex min-w-0 items-center gap-1'>
				{onSave && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size='sm'
								variant='ghost'
								className='h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]'
								onClick={onSave}
								aria-label='Save to Snippet Library'
							>
								<Bookmark className='h-3.5 w-3.5' />
								<span className='hidden sm:inline'>Save</span>
								<Kbd className='ml-0.5 inline-flex'>⌘S</Kbd>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Save to Snippet Library</TooltipContent>
					</Tooltip>
				)}

				{onAskAi && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size='sm'
								variant='ghost'
								className='h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]'
								onClick={onAskAi}
								aria-label='Ask AI to write SQL'
							>
								<Sparkles className='h-3.5 w-3.5' />
								<span className='hidden sm:inline'>Ask AI</span>
								<Kbd className='ml-0.5 inline-flex'>{formatShortcut('mod+i')}</Kbd>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Ask AI to write SQL from a prompt</TooltipContent>
					</Tooltip>
				)}

				{onPrettify && (
					<ToolbarIconButton label='Format code (Shift+Alt+F)' onClick={onPrettify}>
						<AlignLeft className='h-3.5 w-3.5' />
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

				{onExplainQuery && (
					<ToolbarIconButton label='Explain this query with AI' onClick={onExplainQuery}>
						<BookOpen className='h-3.5 w-3.5' />
					</ToolbarIconButton>
				)}

				{onExplainAnalyze && (
					<ToolbarIconButton label='Run with EXPLAIN ANALYZE' onClick={onExplainAnalyze}>
						<Gauge className='h-3.5 w-3.5' />
					</ToolbarIconButton>
				)}

				{onExport && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<ToolbarIconButton label='Export results' disabled={!hasResults}>
								<Download className='h-3.5 w-3.5' />
							</ToolbarIconButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='start'>
							<DropdownMenuItem onClick={onExport}>Export as JSON</DropdownMenuItem>
							<DropdownMenuItem onClick={onExportCsv}>Export as CSV</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>

			<div className='flex shrink-0 items-center gap-1.5'>
				{isExecuting && onCancel ? (
					<Button
						size='sm'
						variant='default'
						className='h-7 gap-2 rounded-md px-3 text-xs font-semibold shadow-sm transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] bg-destructive/90 text-destructive-foreground hover:bg-destructive'
						onClick={onCancel}
					>
						<Square className='h-3 w-3 fill-current' />
						<span>Stop</span>
					</Button>
				) : onRun ? (
					<Button
						size='sm'
						variant='default'
						className='h-7 gap-2 rounded-md px-3 text-xs font-semibold shadow-sm transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90'
						onClick={onRun}
					>
						<Play className='h-3.5 w-3.5 fill-current' />
						<span>Run</span>
						<Kbd className='inline-flex border-white/40 bg-black/40 text-white'>⌘↵</Kbd>
					</Button>
				) : null}

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='ghost'
							size='sm'
							className={cn(
								'h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.97]',
								showRightSidebar && 'bg-sidebar-accent'
							)}
							onClick={onToggleRightSidebar}
							aria-label='Toggle snippets'
						>
							<PanelRight
								className={cn(
									'h-3.5 w-3.5 transition-transform duration-200',
									showRightSidebar && 'rotate-180'
								)}
								style={{
									transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
								}}
							/>
							<span className='hidden lg:inline'>Snippets</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Toggle snippets</TooltipContent>
				</Tooltip>
			</div>
		</div>
	)
}

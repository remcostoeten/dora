import { forwardRef } from 'react'
import {
	Trash2,
	Copy,
	X,
	Ban,
	Download,
	FileJson,
	FileSpreadsheet,
	CopyPlus,
	Pencil
} from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/shared/ui/dropdown-menu'
import { cn } from '@/shared/utils/cn'

type Props = {
	selectedCount: number
	onDelete?: () => void
	onCopy?: () => void
	onSetNull?: () => void
	onDuplicate?: () => void
	onExportJson?: () => void
	onExportCsv?: () => void
	onBulkEdit?: () => void
	onClearSelection: () => void
	mode?: 'floating' | 'static'
}

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function handleToolbarKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
	const toolbar = e.currentTarget
	const focusable = Array.from(toolbar.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
	const idx = focusable.indexOf(document.activeElement as HTMLElement)
	if (idx === -1) return

	switch (e.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			e.preventDefault()
			focusable[(idx + 1) % focusable.length]?.focus()
			break
		case 'ArrowLeft':
		case 'ArrowUp':
			e.preventDefault()
			focusable[(idx - 1 + focusable.length) % focusable.length]?.focus()
			break
		case 'Home':
			e.preventDefault()
			focusable[0]?.focus()
			break
		case 'End':
			e.preventDefault()
			focusable[focusable.length - 1]?.focus()
			break
	}
}

function ShortcutBadge({ children }: { children: React.ReactNode }) {
	return (
		<span
			className='ml-1.5 hidden lg:inline-flex h-4 min-w-[20px] items-center justify-center rounded border border-border bg-background px-1.5 font-sans text-[10px] font-medium text-muted-foreground'
			aria-hidden='true'
		>
			{children}
		</span>
	)
}

export const SelectionActionBar = forwardRef<HTMLDivElement, Props>(function SelectionActionBar(
	{
		selectedCount,
		onDelete,
		onCopy,
		onSetNull,
		onDuplicate,
		onExportJson,
		onExportCsv,
		onBulkEdit,
		onClearSelection,
		mode = 'floating'
	},
	ref
) {
	if (selectedCount === 0) return null

	const hasExportOptions = onExportJson || onExportCsv
	const rowLabel = `${selectedCount} row${selectedCount !== 1 ? 's' : ''}`

	const floatingClasses = [
		'absolute bottom-10 left-1/2 -translate-x-1/2 z-50',
		'flex items-center gap-2 pl-4 pr-2 py-2',
		'bg-popover/95 backdrop-blur-sm border border-border shadow-2xl rounded-full',
		'animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out'
	]

	const staticClasses = [
		'flex items-center justify-between h-10 px-3 bg-sidebar border-t border-sidebar-border shrink-0',
		'animate-in slide-in-from-bottom-2 duration-200'
	]

	return (
		<div
			ref={ref}
			role='toolbar'
			aria-label={`${rowLabel} selected — row actions. Use arrow keys to navigate between actions.`}
			tabIndex={-1}
			className={cn(
				mode === 'floating' ? floatingClasses : staticClasses,
				'outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				mode === 'floating' && 'rounded-full'
			)}
			onKeyDown={handleToolbarKeyDown}
		>
			<div className={cn('flex items-center gap-3', mode === 'floating' && 'mr-2')}>
				{mode === 'floating' ? (
					<>
						<span
							className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5'
							title={`${rowLabel} selected — press Alt+T to focus this toolbar`}
							aria-hidden='true'
						>
							{selectedCount}
						</span>
						<span className='text-sm font-medium text-foreground'>
							<span className='sr-only'>{rowLabel} </span>
							Selected
						</span>
					</>
				) : (
					<div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
						<span
							className='bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full'
							aria-hidden='true'
						>
							{selectedCount}
						</span>
						<span>
							<span className='sr-only'>{selectedCount} </span>
							row{selectedCount !== 1 ? 's' : ''} selected
						</span>
					</div>
				)}
			</div>

			<div className='h-4 w-px bg-border mx-1' aria-hidden='true' />

			<div
				className={cn('flex items-center', mode === 'floating' ? 'gap-0.5' : 'gap-1')}
				role='group'
				aria-label='Row actions'
			>
				{onCopy && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5',
							mode === 'floating'
								? 'h-8 rounded-full px-3 hover:bg-primary/10 hover:text-primary'
								: 'h-7 px-2 text-muted-foreground hover:text-foreground'
						)}
						onClick={onCopy}
						title={`Copy ${rowLabel} as JSON`}
						aria-label={`Copy ${rowLabel} as JSON`}
					>
						<Copy className='h-3.5 w-3.5' aria-hidden='true' />
						Copy
					</Button>
				)}

				{onDuplicate && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5',
							mode === 'floating'
								? 'h-8 rounded-full px-3 hover:bg-primary/10 hover:text-primary'
								: 'h-7 px-2 text-muted-foreground hover:text-foreground'
						)}
						onClick={onDuplicate}
						title={`Duplicate ${rowLabel}`}
						aria-label={`Duplicate ${rowLabel}`}
					>
						<CopyPlus className='h-3.5 w-3.5' aria-hidden='true' />
						Duplicate
					</Button>
				)}

				{hasExportOptions && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant='ghost'
								size='sm'
								className={cn(
									'text-xs gap-1.5',
									mode === 'floating'
										? 'h-8 rounded-full px-3 hover:bg-primary/10 hover:text-primary'
										: 'h-7 px-2 text-muted-foreground hover:text-foreground'
								)}
								title={`Export ${rowLabel}`}
								aria-label={`Export ${rowLabel} — opens format menu`}
								aria-haspopup='menu'
							>
								<Download className='h-3.5 w-3.5' aria-hidden='true' />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align={mode === 'floating' ? 'center' : 'start'}
							className='w-40'
						>
							{onExportJson && (
								<DropdownMenuItem onClick={onExportJson}>
									<FileJson className='h-3.5 w-3.5 mr-2' aria-hidden='true' />
									JSON
								</DropdownMenuItem>
							)}
							{onExportCsv && (
								<DropdownMenuItem onClick={onExportCsv}>
									<FileSpreadsheet className='h-3.5 w-3.5 mr-2' aria-hidden='true' />
									CSV
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}

				{onBulkEdit && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5',
							mode === 'floating'
								? 'h-8 rounded-full px-3 hover:bg-primary/10 hover:text-primary'
								: 'h-7 px-2 text-muted-foreground hover:text-foreground'
						)}
						onClick={onBulkEdit}
						title={`Bulk edit ${rowLabel}`}
						aria-label={`Bulk edit ${rowLabel}`}
					>
						<Pencil className='h-3.5 w-3.5' aria-hidden='true' />
						Edit
					</Button>
				)}

				{onSetNull && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5',
							mode === 'floating'
								? 'h-8 rounded-full px-3 hover:bg-primary/10 hover:text-primary'
								: 'h-7 px-2 text-muted-foreground hover:text-foreground'
						)}
						onClick={onSetNull}
						title={`Set column to NULL for ${rowLabel}`}
						aria-label={`Set NULL for ${rowLabel}`}
					>
						<Ban className='h-3.5 w-3.5' aria-hidden='true' />
						Set NULL
					</Button>
				)}

				{onDelete && (
					<Button
						variant='ghost'
						size='sm'
						className={cn(
							'text-xs gap-1.5',
							mode === 'floating'
								? 'h-8 rounded-full px-3 text-destructive hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300'
								: 'h-7 px-2 text-destructive hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
						)}
						onClick={onDelete}
						title={`Delete ${rowLabel} (Del)`}
						aria-label={`Delete ${rowLabel}`}
						aria-keyshortcuts='Delete'
					>
						<Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
						Delete
						<ShortcutBadge>Del</ShortcutBadge>
					</Button>
				)}
			</div>

			{mode === 'floating' && <div className='h-4 w-px bg-border mx-1' aria-hidden='true' />}

			<Button
				variant='ghost'
				size='icon'
				className={cn(
					'hover:bg-muted',
					mode === 'floating' ? 'h-8 w-8 rounded-full' : 'h-7 w-7 rounded-md ml-auto'
				)}
				onClick={onClearSelection}
				title='Clear selection (Esc)'
				aria-label='Clear selection'
				aria-keyshortcuts='Escape'
			>
				<X className='h-4 w-4' aria-hidden='true' />
				<ShortcutBadge>Esc</ShortcutBadge>
			</Button>
		</div>
	)
})

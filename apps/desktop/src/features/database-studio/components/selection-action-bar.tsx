import { Trash2, Copy, X, Ban, Download, FileJson, FileSpreadsheet, CopyPlus, Pencil } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";

type Props = {
	selectedCount: number
	onDelete?: () => void
	onCopy?: () => void
	onSetNull?: () => void
	onDuplicate?: () => void
	onExportJson?: () => void
	onBulkEdit?: () => void
	onClearSelection: () => void
	mode?: 'floating' | 'static'
}

export function SelectionActionBar({
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
}: Props) {
	if (selectedCount === 0) return null

	const hasExportOptions = onExportJson || onExportCsv

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
		<div className={cn(mode === 'floating' ? floatingClasses : staticClasses)}>
			<div className={cn('flex items-center gap-3', mode === 'floating' && 'mr-2')}>
				{mode === 'floating' ? (
					<>
						<span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1.5'>
							{selectedCount}
						</span>
						<span className='text-sm font-medium text-foreground'>Selected</span>
					</>
				) : (
					<div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
						<span className='bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full'>
							{selectedCount}
						</span>
						<span>row{selectedCount !== 1 ? 's' : ''} selected</span>
					</div>
				)}
			</div>

			{mode === 'floating' && <div className='h-4 w-px bg-border mx-1' />}
			{mode === 'static' && <div className='h-4 w-px bg-sidebar-border mx-3' />}

			<div className={cn('flex items-center', mode === 'floating' ? 'gap-0.5' : 'gap-1')}>
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
					>
						<Copy className='h-3.5 w-3.5' />
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
					>
						<CopyPlus className='h-3.5 w-3.5' />
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
							>
								<Download className='h-3.5 w-3.5' />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align={mode === 'floating' ? 'center' : 'start'}
							className='w-40'
						>
							{onExportJson && (
								<DropdownMenuItem onClick={onExportJson}>
									<FileJson className='h-3.5 w-3.5 mr-2' />
									JSON
								</DropdownMenuItem>
							)}
							{onExportCsv && (
								<DropdownMenuItem onClick={onExportCsv}>
									<FileSpreadsheet className='h-3.5 w-3.5 mr-2' />
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
					>
						<Pencil className='h-3.5 w-3.5' />
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
					>
						<Ban className='h-3.5 w-3.5' />
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
								? 'h-8 rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive'
								: 'h-7 px-2 text-destructive hover:bg-destructive/10'
						)}
						onClick={onDelete}
					>
						<Trash2 className='h-3.5 w-3.5' />
						Delete
					</Button>
				)}
			</div>

			{mode === 'floating' && <div className='h-4 w-px bg-border mx-1' />}

			<Button
				variant='ghost'
				size='icon'
				className={cn(
					'hover:bg-muted',
					mode === 'floating' ? 'h-8 w-8 rounded-full' : 'h-7 w-7 rounded-md ml-auto'
				)}
				onClick={onClearSelection}
				title='Clear selection'
			>
				<X className='h-4 w-4' />
			</Button>
		</div>
	)
}

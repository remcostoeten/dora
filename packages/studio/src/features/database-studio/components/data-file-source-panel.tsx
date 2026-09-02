import { Badge } from '@studio/shared/ui/badge'
import { Button } from '@studio/shared/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@studio/shared/ui/collapsible'
import { Spinner } from '@studio/shared/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { dataFileSourceStatusLabel } from '@studio/features/connections/types/data-file-source'
import type { DataFileHealth } from '@studio/features/connections/data-file-health'
import { DATA_FILE_HELP_ITEMS } from '@studio/features/connections/data-file-health'
import { DATA_FILE_READONLY_MESSAGE } from '@studio/features/connections/source-labels'
import { DataFileHealthIndicator } from '@studio/features/connections/components/data-file-health-indicator'
import {
	ChevronRight,
	CircleHelp,
	FileWarning,
	FolderSearch,
	Lock,
	RefreshCw,
	Trash2
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

type RecoveryActions = {
	onRemove?: (path: string) => void
	onRelocate?: (path: string) => void
	onRetry?: () => void
	isRecovering?: boolean
}

type Props = {
	entries: DataFileSourceEntry[]
	isReadonly?: boolean
	selectedTableName?: string | null
	className?: string
	health?: DataFileHealth | null
	headerActions?: ReactNode
} & RecoveryActions

function statusBadgeClass(status: DataFileSourceEntry['status']): string {
	switch (status) {
		case 'missing':
			return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
		case 'failed':
			return 'border-destructive/30 bg-destructive/10 text-destructive'
		default:
			return ''
	}
}

function summarizeEntries(entries: DataFileSourceEntry[]): string {
	return entries.length === 1 ? '1 file' : `${entries.length} files`
}

export function DataFileSourcePanel({
	entries,
	isReadonly = true,
	selectedTableName,
	className,
	health,
	headerActions,
	onRemove,
	onRelocate,
	onRetry,
	isRecovering = false
}: Props) {
	const hasIssues = entries.some((entry) => entry.status !== 'active')
	const canRemove = entries.length > 1
	const [open, setOpen] = useState(hasIssues)

	useEffect(() => {
		if (hasIssues) {
			setOpen(true)
		}
	}, [hasIssues])

	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className={cn('border-b border-border/60 bg-background/80', className)}
		>
			<section
				aria-label='Data file sources'
				className='flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-1.5'
			>
				<CollapsibleTrigger className='flex min-w-0 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground'>
					<ChevronRight
						className={cn(
							'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
							open && 'rotate-90'
						)}
						aria-hidden
					/>
					<span className='font-medium text-foreground'>Data files</span>
					<span className='shrink-0'>{summarizeEntries(entries)}</span>
					{health && health !== 'active' && (
						<DataFileHealthIndicator health={health} compact />
					)}
				</CollapsibleTrigger>
				<div className='flex flex-wrap items-center gap-2'>
					{hasIssues && onRetry && (
						<Button
							type='button'
							variant='outline'
							size='sm'
							className='h-7 gap-1 px-2 text-xs'
							disabled={isRecovering}
							onClick={onRetry}
						>
							{isRecovering ? (
								<Spinner className='h-3 w-3' aria-hidden />
							) : (
								<RefreshCw className='h-3 w-3' aria-hidden />
							)}
							Retry registration
						</Button>
					)}
					{headerActions}
					{isReadonly && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Badge
									variant='outline'
									className='gap-1 font-normal text-muted-foreground'
								>
									<Lock className='h-3 w-3' aria-hidden />
									Readonly
								</Badge>
							</TooltipTrigger>
							<TooltipContent side='bottom' className='max-w-72'>
								{DATA_FILE_READONLY_MESSAGE}
							</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type='button'
								aria-label='How data files work in Dora'
								className='text-muted-foreground transition-colors hover:text-foreground'
							>
								<CircleHelp className='h-3.5 w-3.5' aria-hidden />
							</button>
						</TooltipTrigger>
						<TooltipContent side='bottom' className='max-w-80'>
							<ul className='space-y-1.5 py-0.5'>
								{DATA_FILE_HELP_ITEMS.map((item) => (
									<li key={item} className='flex gap-2'>
										<span aria-hidden className='text-muted-foreground'>
											•
										</span>
										<span>{item}</span>
									</li>
								))}
							</ul>
						</TooltipContent>
					</Tooltip>
				</div>
			</section>

			<CollapsibleContent>
				<div className='px-4 pb-3'>
					{hasIssues && (
						<div className='mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200'>
							<FileWarning className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden />
							<p>
								Some files could not be registered. Active views remain queryable;
								fix or remove problem files below.
							</p>
						</div>
					)}

					<ul className='space-y-1.5'>
						{entries.map((entry) => {
							const isSelected =
								selectedTableName != null &&
								selectedTableName.toLowerCase() === entry.viewName.toLowerCase()
							const showRecovery = entry.status !== 'active'

							return (
								<li
									key={entry.path}
									className={cn(
										'rounded-md border px-3 py-1.5 text-xs',
										isSelected
											? 'border-primary/30 bg-primary/5'
											: 'border-border/70 bg-muted/20'
									)}
								>
									<div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
										<span className='shrink-0 font-medium text-foreground'>
											{entry.fileType}
										</span>
										<code className='shrink-0 rounded bg-background px-1.5 py-0.5 text-[11px] text-foreground'>
											{entry.viewName}
										</code>
										{entry.status !== 'active' && (
											<Badge
												variant='outline'
												className={cn(
													'font-normal',
													statusBadgeClass(entry.status)
												)}
											>
												{dataFileSourceStatusLabel(entry.status)}
											</Badge>
										)}
										{isSelected && entry.status === 'active' && (
											<Badge variant='secondary' className='font-normal'>
												Viewing
											</Badge>
										)}
										<span
											className='min-w-0 flex-1 truncate text-right font-mono text-[11px] text-muted-foreground'
											title={entry.path}
										>
											{entry.path}
										</span>
									</div>
									{entry.error && entry.status !== 'active' && (
										<p className='mt-1 text-[11px] text-destructive/90'>
											{entry.error}
										</p>
									)}
									{showRecovery && (
										<div className='mt-2 flex flex-wrap gap-2'>
											{onRelocate && (
												<Button
													type='button'
													variant='outline'
													size='sm'
													className='h-7 gap-1 px-2 text-xs'
													disabled={isRecovering}
													onClick={() => onRelocate(entry.path)}
												>
													<FolderSearch className='h-3 w-3' aria-hidden />
													Locate file
												</Button>
											)}
											{onRemove && canRemove && (
												<Button
													type='button'
													variant='outline'
													size='sm'
													className='h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive'
													disabled={isRecovering}
													onClick={() => onRemove(entry.path)}
												>
													<Trash2 className='h-3 w-3' aria-hidden />
													Remove source
												</Button>
											)}
										</div>
									)}
								</li>
							)
						})}
					</ul>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

import {
	Table,
	FileJson,
	BarChart3,
	Trash2,
	Edit3,
	Filter,
	Columns,
	Download,
	Plus,
	RefreshCw,
	Sparkles,
	Copy,
	Upload
} from 'lucide-react'
import { useState, useEffect, type ComponentProps } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { Tooltip, TooltipTrigger, TooltipContent } from '@studio/shared/ui/tooltip'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuSeparator
} from '@studio/shared/ui/dropdown-menu'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { ViewMode, PaginationState, FilterGroup, ColumnDefinition, isFilterGroup } from '../types'
import type { LiveMonitorConfig, ChangeEvent } from '@studio/core/live-monitor'
import { LiveMonitorPopover } from './live-monitor-popover'
import { ChangeFeed } from './change-feed'
import { FilterBar } from './filter-bar'
import type { ReactNode } from 'react'

/** Counts leaf conditions in a filter group, recursing into nested groups. */
function countConditions(group: FilterGroup): number {
	return group.conditions.reduce(function (total, node) {
		return total + (isFilterGroup(node) ? countConditions(node) : 1)
	}, 0)
}

type TooltipButtonProps = ComponentProps<typeof Button> & { tooltip: string }

/**
 * Icon button with the same hover tooltip used across the SQL console toolbar,
 * so the data viewer's icons get matching tooltips instead of native `title`.
 */
function TooltipButton({ tooltip, children, ...props }: TooltipButtonProps) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button aria-label={tooltip} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{tooltip}</TooltipContent>
		</Tooltip>
	)
}

type Props = {
	tableName: string
	viewMode: ViewMode
	onViewModeChange: (mode: ViewMode) => void
	onRefresh: () => void
	onExport: () => void
	onExportCsv?: () => void
	onExportSql?: () => void
	onBackup?: () => void
	onRestore?: () => void
	onAddRecord?: () => void
	isLoading?: boolean
	filterGroup?: FilterGroup
	onFilterGroupChange?: (group: FilterGroup) => void
	columns?: ColumnDefinition[]
	visibleColumns?: Set<string>
	onToggleColumn?: (columnName: string, visible: boolean) => void
	isDryEditMode?: boolean
	onDryEditModeChange?: (enabled: boolean) => void
	onImportCsv?: () => void
	importFilesAction?: ReactNode
	onSeed?: () => void
	onCopySchema?: () => void
	onCopyDrizzleSchema?: () => void
	liveMonitorConfig?: LiveMonitorConfig
	onLiveMonitorConfigChange?: (config: LiveMonitorConfig) => void
	isLiveMonitorPolling?: boolean
	changeEvents?: ChangeEvent[]
	unreadChangeCount?: number
	onClearChangeEvents?: () => void
	onMarkChangesRead?: () => void
}

export function StudioToolbar({
	tableName,
	viewMode,
	onViewModeChange,
	onRefresh,
	onExport,
	onExportCsv,
	onExportSql,
	onBackup,
	onRestore,
	onAddRecord,
	isLoading,
	filterGroup = { logic: 'AND', conditions: [] },
	onFilterGroupChange,
	columns = [],
	visibleColumns,
	onToggleColumn,
	isDryEditMode,
	onDryEditModeChange,
	onSeed,
	onCopySchema,
	onCopyDrizzleSchema,
	liveMonitorConfig,
	onLiveMonitorConfigChange,
	isLiveMonitorPolling,
	changeEvents,
	unreadChangeCount,
	onImportCsv,
	importFilesAction,
	onClearChangeEvents,
	onMarkChangesRead
}: Props) {
	const filterCount = countConditions(filterGroup)
	const [showFilters, setShowFilters] = useState(filterCount > 0)

	useEffect(() => {
		if (filterCount > 0) {
			setShowFilters(true)
		}
	}, [filterCount])

	return (
		<div className='flex flex-col shrink-0 bg-sidebar border-b border-sidebar-border'>
			<div className='flex items-center h-10 pl-2 pr-2 gap-2 text-sm overflow-x-auto scrollbar-none'>
				<div className='flex items-center gap-1 mr-2'>
					<div className='flex items-center bg-sidebar-accent/50 rounded-md p-0.5'>
						<TooltipButton
							variant='ghost'
							size='icon'
							className={cn(
								'h-6 w-6 rounded-sm',
								viewMode === 'content'
									? 'bg-sidebar-accent text-sidebar-foreground shadow-xs'
									: 'text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent'
							)}
							onClick={() => onViewModeChange('content')}
							tooltip='Content View'
						>
							<Table className='h-3.5 w-3.5' />
						</TooltipButton>
						<TooltipButton
							variant='ghost'
							size='icon'
							className={cn(
								'h-6 w-6 rounded-sm',
								viewMode === 'structure'
									? 'bg-sidebar-accent text-sidebar-foreground shadow-xs'
									: 'text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent'
							)}
							onClick={() => onViewModeChange('structure')}
							tooltip='Structure View'
						>
							<FileJson className='h-3.5 w-3.5' />
						</TooltipButton>
						<TooltipButton
							variant='ghost'
							size='icon'
							className={cn(
								'h-6 w-6 rounded-sm',
								viewMode === 'chart'
									? 'bg-sidebar-accent text-sidebar-foreground shadow-xs'
									: 'text-muted-foreground hover:text-sidebar-foreground hover:bg-transparent'
							)}
							onClick={() => onViewModeChange('chart')}
							tooltip='Chart View'
						>
							<BarChart3 className='h-3.5 w-3.5' />
						</TooltipButton>
					</div>
					<div className='h-4 w-px bg-sidebar-border mx-1' />
					<Button
						variant={showFilters || filterCount > 0 ? 'secondary' : 'ghost'}
						size='sm'
						className={cn(
							'h-7 px-2 text-xs gap-1.5 ml-1',
							(showFilters || filterCount > 0) &&
								'text-sidebar-foreground bg-sidebar-accent'
						)}
						onClick={() => setShowFilters(!showFilters)}
					>
						<Filter className='h-3.5 w-3.5' />
						<span className='hidden sm:inline'>Filters</span>
						{filterCount > 0 && (
							<span className='bg-primary text-primary-foreground text-[10px] px-1 rounded-full min-w-[14px] h-3.5 flex items-center justify-center'>
								{filterCount}
							</span>
						)}
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant='ghost'
								size='sm'
								className='h-7 px-2 text-xs text-muted-foreground hover:text-sidebar-foreground gap-1.5'
							>
								<Columns className='h-3.5 w-3.5' />
								<span className='hidden sm:inline'>Columns</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align='start'
							className='w-[200px] max-h-[300px] overflow-auto'
						>
							<div className='px-2 py-1.5 border-b border-sidebar-border/50 sticky top-0 bg-popover z-10'>
								<Input
									placeholder='Search columns...'
									className='h-7 text-xs bg-transparent border-none shadow-none focus-visible:ring-0 px-0'
								/>
							</div>
							{columns.map((col) => (
								<DropdownMenuCheckboxItem
									key={col.name}
									checked={visibleColumns ? visibleColumns.has(col.name) : true}
									onCheckedChange={(checked) =>
										onToggleColumn?.(col.name, !!checked)
									}
								>
									{col.name}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className='flex-1' />

				{/* Right Section: Actions & Stats */}
				<div className='flex items-center gap-2'>
					{onDryEditModeChange && (
						<TooltipButton
							variant={isDryEditMode ? 'secondary' : 'ghost'}
							size='icon'
							className={cn(
								'h-7 w-7',
								isDryEditMode &&
									'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
							)}
							onClick={function () {
								onDryEditModeChange(!isDryEditMode)
							}}
							tooltip={
								isDryEditMode
									? 'Dry Edit — disable (currently staging changes)'
									: 'Dry Edit — stage changes before saving'
							}
						>
							<Edit3 className='h-3.5 w-3.5' />
						</TooltipButton>
					)}

					{onSeed && (
						<TooltipButton
							variant='ghost'
							size='icon'
							className='h-7 w-7'
							onClick={onSeed}
							tooltip='Seed Data — generate mock data using AI'
						>
							<Sparkles className='h-3.5 w-3.5 text-blue-400' />
						</TooltipButton>
					)}

					{onImportCsv && (
						<TooltipButton
							variant='outline'
							size='icon'
							className='h-7 w-7'
							onClick={onImportCsv}
							tooltip='Import CSV'
						>
							<Upload className='h-3.5 w-3.5' />
						</TooltipButton>
					)}

					{importFilesAction}

					<TooltipButton
						variant='default'
						size='sm'
						className='h-7 px-2 text-xs gap-1 mr-2'
						onClick={onAddRecord}
						disabled={!onAddRecord}
						tooltip={onAddRecord ? 'Add new record' : 'Not connected to backend'}
					>
						<Plus className='h-3.5 w-3.5' />
						<span className='hidden sm:inline'>Add record</span>
					</TooltipButton>

					<div className='h-4 w-px bg-sidebar-border mx-1' />

					{liveMonitorConfig && onLiveMonitorConfigChange && (
						<LiveMonitorPopover
							config={liveMonitorConfig}
							onConfigChange={onLiveMonitorConfigChange}
							isPolling={isLiveMonitorPolling || false}
						/>
					)}

					{changeEvents && onClearChangeEvents && onMarkChangesRead && (
						<ChangeFeed
							events={changeEvents}
							unreadCount={unreadChangeCount || 0}
							onClear={onClearChangeEvents}
							onMarkRead={onMarkChangesRead}
						/>
					)}

					<TooltipButton
						variant='ghost'
						size='icon'
						className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
						onClick={onRefresh}
						disabled={isLoading}
						tooltip='Refresh'
					>
						{isLoading ? (
							<Spinner className='h-3.5 w-3.5' />
						) : (
							<RefreshCw className='h-3.5 w-3.5' />
						)}
					</TooltipButton>

					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										variant='ghost'
										size='icon'
										className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
										aria-label='Export'
									>
										<Download className='h-3.5 w-3.5' />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent>Export</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={onExport}>Export JSON</DropdownMenuItem>
							{onExportCsv && (
								<DropdownMenuItem onClick={onExportCsv}>
									Export CSV
								</DropdownMenuItem>
							)}
							{onExportSql && (
								<DropdownMenuItem onClick={onExportSql}>
									Export SQL INSERT
								</DropdownMenuItem>
							)}
							{(onBackup || onRestore) && <DropdownMenuSeparator />}
							{onBackup && (
								<DropdownMenuItem onClick={onBackup}>
									<Download className='h-3.5 w-3.5' />
									Backup database…
								</DropdownMenuItem>
							)}
							{onRestore && (
								<DropdownMenuItem onClick={onRestore}>
									<Upload className='h-3.5 w-3.5' />
									Restore from backup…
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					{(onCopySchema || onCopyDrizzleSchema) && (
						<DropdownMenu>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button
											variant='ghost'
											size='icon'
											className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
											aria-label='Copy Schema'
										>
											<Copy className='h-3.5 w-3.5' />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Copy Schema</TooltipContent>
							</Tooltip>
							<DropdownMenuContent align='end'>
								{onCopySchema && (
									<DropdownMenuItem onClick={onCopySchema}>
										Copy SQL Schema
									</DropdownMenuItem>
								)}
								{onCopyDrizzleSchema && (
									<DropdownMenuItem onClick={onCopyDrizzleSchema}>
										Copy Drizzle Schema
									</DropdownMenuItem>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>

			{/* Filter Bar */}
			<FilterBar
				isVisible={showFilters}
				group={filterGroup}
				onGroupChange={onFilterGroupChange || (() => {})}
				columns={columns}
			/>
		</div>
	)
}

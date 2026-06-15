import { useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Columns, Trash2, X } from 'lucide-react'
import type { ChangeEvent, LiveMonitorConfig } from '@studio/core/live-monitor'
import { AddColumnDialog } from './add-column-dialog'
import type { ColumnFormData } from './add-column-dialog'
import { BottomStatusBar } from './bottom-status-bar'
import { DropColumnDialog } from './drop-column-dialog'
import { DropTableDialog } from './drop-table-dialog'
import { StudioToolbar } from './studio-toolbar'
import type { ColumnDefinition, PaginationState, TableData, ViewMode } from '../types'

type Props = {
	displayTableName: string
	tableData: TableData
	viewMode: ViewMode
	onViewModeChange: (mode: ViewMode) => void
	onRefresh: () => void
	onExport: () => void
	onExportCsv?: () => void
	onExportSql?: () => void
	onBackup?: () => void
	onRestore?: () => void
	isLoading: boolean
	onCopySchema: () => void
	onCopyDrizzleSchema: () => void
	liveMonitorConfig?: LiveMonitorConfig
	onLiveMonitorConfigChange?: (config: LiveMonitorConfig) => void
	isLiveMonitorPolling?: boolean
	changeEvents?: ChangeEvent[]
	unreadChangeCount?: number
	onClearChangeEvents?: () => void
	onMarkChangesRead?: () => void
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	liveMonitorIntervalMs: number
	lastPolledAt: number | null
	liveMonitorError: string | null
	showAddColumnDialog: boolean
	onShowAddColumnDialogChange: (open: boolean) => void
	onAddColumn?: (column: ColumnFormData) => void
	showDropTableDialog: boolean
	onShowDropTableDialogChange: (open: boolean) => void
	onDropTable?: () => void
	onDropColumn?: (columnName: string) => void
	isDdlLoading: boolean
}

export function DatabaseStudioStructureView({
	displayTableName,
	tableData,
	viewMode,
	onViewModeChange,
	onRefresh,
	onExport,
	onExportCsv,
	onExportSql,
	onBackup,
	onRestore,
	isLoading,
	onCopySchema,
	onCopyDrizzleSchema,
	liveMonitorConfig,
	onLiveMonitorConfigChange,
	isLiveMonitorPolling,
	changeEvents,
	unreadChangeCount,
	onClearChangeEvents,
	onMarkChangesRead,
	pagination,
	onPaginationChange,
	liveMonitorIntervalMs,
	lastPolledAt,
	liveMonitorError,
	showAddColumnDialog,
	onShowAddColumnDialogChange,
	onAddColumn,
	showDropTableDialog,
	onShowDropTableDialogChange,
	onDropTable,
	onDropColumn,
	isDdlLoading
}: Props) {
	const [columnPendingDrop, setColumnPendingDrop] = useState<string | null>(null)

	const canDropColumn = Boolean(onDropColumn) && tableData.columns.length > 1

	return (
		<div className='flex flex-col h-full bg-background'>
			<StudioToolbar
				tableName={displayTableName}
				viewMode={viewMode}
				onViewModeChange={onViewModeChange}
				onRefresh={onRefresh}
				onExport={onExport}
				onExportCsv={onExportCsv}
				onExportSql={onExportSql}
				onBackup={onBackup}
				onRestore={onRestore}
				isLoading={isLoading}
				onCopySchema={onCopySchema}
				onCopyDrizzleSchema={onCopyDrizzleSchema}
				liveMonitorConfig={liveMonitorConfig}
				onLiveMonitorConfigChange={onLiveMonitorConfigChange}
				isLiveMonitorPolling={isLiveMonitorPolling}
				changeEvents={changeEvents}
				unreadChangeCount={unreadChangeCount}
				onClearChangeEvents={onClearChangeEvents}
				onMarkChangesRead={onMarkChangesRead}
			/>

			<div className='flex-1 overflow-auto p-4'>
				<div className='max-w-2xl'>
					<h2 className='text-lg font-medium text-sidebar-foreground mb-4'>
						Table Structure
					</h2>
					<table className='w-full text-sm'>
						<thead>
							<tr className='border-b border-sidebar-border'>
								<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
									Column
								</th>
								<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
									Type
								</th>
								<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
									Nullable
								</th>
								<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
									Primary Key
								</th>
								{canDropColumn && <th className='w-8 py-2 px-3' />}
							</tr>
						</thead>
						<tbody>
							{tableData.columns.map((col: ColumnDefinition) => (
								<tr key={col.name} className='group border-b border-sidebar-border/50'>
									<td className='py-2 px-3 font-mono text-sidebar-foreground'>
										{col.name}
									</td>
									<td className='py-2 px-3 font-mono text-primary'>
										{col.type}
									</td>
									<td className='py-2 px-3'>
										{col.nullable ? (
											<span className='text-muted-foreground'>Yes</span>
										) : (
											<span className='text-warning'>No</span>
										)}
									</td>
									<td className='py-2 px-3'>
										{col.primaryKey && (
											<span className='text-warning font-medium'>PK</span>
										)}
									</td>
									{canDropColumn && (
										<td className='py-2 px-3 text-right'>
											<button
												type='button'
												aria-label={`Drop column ${col.name}`}
												title={`Drop column "${col.name}"`}
												onClick={function () {
													setColumnPendingDrop(col.name)
												}}
												className='text-muted-foreground/50 opacity-0 transition hover:text-destructive group-hover:opacity-100 focus:opacity-100'
											>
												<X className='h-4 w-4' />
											</button>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>

					{onAddColumn && onDropTable && (
						<div className='flex gap-2 mt-6'>
							<Button
								variant='outline'
								size='sm'
								onClick={function () {
									onShowAddColumnDialogChange(true)
								}}
								className='gap-2'
							>
								<Columns className='h-4 w-4' />
								Add Column
							</Button>
							<Button
								variant='outline'
								size='sm'
								onClick={function () {
									onShowDropTableDialogChange(true)
								}}
								className='gap-2 text-destructive hover:text-destructive'
							>
								<Trash2 className='h-4 w-4' />
								Drop Table
							</Button>
						</div>
					)}
				</div>
			</div>

			<BottomStatusBar
				pagination={pagination}
				onPaginationChange={onPaginationChange}
				rowCount={tableData.rows.length}
				totalCount={tableData.totalCount}
				executionTime={tableData.executionTime}
				liveMonitorEnabled={liveMonitorConfig?.enabled}
				liveMonitorIntervalMs={liveMonitorIntervalMs}
				lastPolledAt={lastPolledAt}
				changesDetected={unreadChangeCount}
				liveMonitorError={liveMonitorError}
			/>

			{onAddColumn && (
				<AddColumnDialog
					open={showAddColumnDialog}
					onOpenChange={onShowAddColumnDialogChange}
					tableName={displayTableName}
					onSubmit={onAddColumn}
					isLoading={isDdlLoading}
				/>
			)}

			{onDropTable && (
				<DropTableDialog
					open={showDropTableDialog}
					onOpenChange={onShowDropTableDialogChange}
					tableName={displayTableName}
					onConfirm={onDropTable}
					isLoading={isDdlLoading}
				/>
			)}

			{onDropColumn && (
				<DropColumnDialog
					open={columnPendingDrop !== null}
					onOpenChange={function (open) {
						if (!open) setColumnPendingDrop(null)
					}}
					tableName={displayTableName}
					columnName={columnPendingDrop ?? ''}
					onConfirm={function () {
						if (columnPendingDrop) {
							onDropColumn(columnPendingDrop)
							setColumnPendingDrop(null)
						}
					}}
					isLoading={isDdlLoading}
				/>
			)}
		</div>
	)
}

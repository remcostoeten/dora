import { Button } from '@/shared/ui/button'
import { Columns, Trash2 } from 'lucide-react'
import type { ChangeEvent, LiveMonitorConfig } from '@/core/live-monitor'
import { AddColumnDialog } from './add-column-dialog'
import type { ColumnFormData } from './add-column-dialog'
import { BottomStatusBar } from './bottom-status-bar'
import { DropTableDialog } from './drop-table-dialog'
import { StudioToolbar } from './studio-toolbar'
import type { ColumnDefinition, PaginationState, TableData, ViewMode } from '../types'

type Props = {
	displayTableName: string
	tableData: TableData
	viewMode: ViewMode
	onViewModeChange: (mode: ViewMode) => void
	onToggleSidebar?: () => void
	isSidebarOpen?: boolean
	onRefresh: () => void
	onExport: () => void
	onExportCsv: () => void
	onExportSql: () => void
	isLoading: boolean
	onCopySchema: () => void
	onCopyDrizzleSchema: () => void
	liveMonitorConfig: LiveMonitorConfig
	onLiveMonitorConfigChange: (config: LiveMonitorConfig) => void
	isLiveMonitorPolling: boolean
	changeEvents: ChangeEvent[]
	unreadChangeCount: number
	onClearChangeEvents: () => void
	onMarkChangesRead: () => void
	pagination: PaginationState
	onPaginationChange: (pagination: PaginationState) => void
	liveMonitorIntervalMs: number
	lastPolledAt: number | null
	liveMonitorError: string | null
	showAddColumnDialog: boolean
	onShowAddColumnDialogChange: (open: boolean) => void
	onAddColumn: (column: ColumnFormData) => void
	showDropTableDialog: boolean
	onShowDropTableDialogChange: (open: boolean) => void
	onDropTable: () => void
	isDdlLoading: boolean
}

export function DatabaseStudioStructureView({
	displayTableName,
	tableData,
	viewMode,
	onViewModeChange,
	onToggleSidebar,
	isSidebarOpen,
	onRefresh,
	onExport,
	onExportCsv,
	onExportSql,
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
	isDdlLoading
}: Props) {
	return (
		<div className='flex flex-col h-full bg-background'>
			<StudioToolbar
				tableName={displayTableName}
				viewMode={viewMode}
				onViewModeChange={onViewModeChange}
				onToggleSidebar={onToggleSidebar}
				isSidebarOpen={isSidebarOpen}
				onRefresh={onRefresh}
				onExport={onExport}
				onExportCsv={onExportCsv}
				onExportSql={onExportSql}
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
							</tr>
						</thead>
						<tbody>
							{tableData.columns.map((col: ColumnDefinition) => (
								<tr key={col.name} className='border-b border-sidebar-border/50'>
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
								</tr>
							))}
						</tbody>
					</table>

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
				</div>
			</div>

			<BottomStatusBar
				pagination={pagination}
				onPaginationChange={onPaginationChange}
				rowCount={tableData.rows.length}
				totalCount={tableData.totalCount}
				executionTime={tableData.executionTime}
				liveMonitorEnabled={liveMonitorConfig.enabled}
				liveMonitorIntervalMs={liveMonitorIntervalMs}
				lastPolledAt={lastPolledAt}
				changesDetected={unreadChangeCount}
				liveMonitorError={liveMonitorError}
			/>

			<AddColumnDialog
				open={showAddColumnDialog}
				onOpenChange={onShowAddColumnDialogChange}
				tableName={displayTableName}
				onSubmit={onAddColumn}
				isLoading={isDdlLoading}
			/>

			<DropTableDialog
				open={showDropTableDialog}
				onOpenChange={onShowDropTableDialogChange}
				tableName={displayTableName}
				onConfirm={onDropTable}
				isLoading={isDdlLoading}
			/>
		</div>
	)
}

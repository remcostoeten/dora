import { Plus, Database as DatabaseIcon, GripHorizontal } from 'lucide-react'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { SidebarTableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { useAdapter } from '@/core/data-provider'
import { getAdapterError } from '@/core/data-provider/types'
import type { DatabaseSchema, TableInfo } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { getAppearanceSettings, applyAppearanceToDOM } from '@/shared/lib/appearance-store'
import { loadFontPair } from '@/shared/lib/font-loader'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { ConnectionSwitcher } from '../connections/components/connection-switcher'
import { Connection } from '../connections/types'
import { DropTableDialog } from '../database-studio/components/drop-table-dialog'
import { BottomToolbar } from './components/bottom-toolbar'
import { ManageTablesDialog, BulkAction } from './components/manage-tables-dialog'
import { RenameTableDialog } from './components/rename-table-dialog'
import { SchemaSelector } from './components/schema-selector'
import { SidebarBottomPanel } from './components/sidebar-bottom-panel'
import { TableInfoDialog } from './components/table-info-dialog'
import { TableList } from './components/table-list'
import type { TableRightClickAction } from './components/table-list'
import { TableSearch, FilterState } from './components/table-search'
import { Schema, TableItem } from './types'
import { cn } from '@/shared/utils/cn'

const DEFAULT_FILTERS: FilterState = {
	showTables: true,
	showViews: true,
	showMaterializedViews: true
}

type Props = {
	activeNavId?: string
	onNavSelect?: (id: string) => void
	onTableSelect?: (tableId: string, tableName: string) => void
	selectedTableId?: string
	autoSelectFirstTable?: boolean
	onAutoSelectComplete?: () => void
	connections?: Connection[]
	activeConnectionId?: string
	onConnectionSelect?: (id: string) => void
	onAddConnection?: () => void
	onManageConnections?: () => void
	onViewConnection?: (id: string) => void
	onEditConnection?: (id: string) => void
	onDeleteConnection?: (id: string) => void
}

export function DatabaseSidebar({
	activeNavId: controlledNavId,
	onNavSelect,
	onTableSelect,
	selectedTableId,
	autoSelectFirstTable,
	onAutoSelectComplete,
	connections = [],
	activeConnectionId,
	onConnectionSelect = function () { },
	onAddConnection = function () { },
	onManageConnections = function () { },
	onViewConnection,
	onEditConnection,
	onDeleteConnection
}: Props = {}) {
	const { toast } = useToast()
	const adapter = useAdapter()
	const [internalNavId, setInternalNavId] = useState('database-studio')
	const activeNavId = controlledNavId ?? internalNavId

	function handleNavSelect(id: string) {
		if (onNavSelect) {
			onNavSelect(id)
		} else {
			setInternalNavId(id)
		}
	}

	const [selectedSchema, setSelectedSchema] = useState<Schema | undefined>()
	const [searchValue, setSearchValue] = useState('')
	const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
	const [internalTableId, setInternalTableId] = useState<string | undefined>()
	const activeTableId = selectedTableId ?? internalTableId
	const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
	const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
	const [editingTableId, setEditingTableId] = useState<string | undefined>()

	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const [isLoadingSchema, setIsLoadingSchema] = useState(false)
	const [schemaError, setSchemaError] = useState<string | null>(null)

	const [showRenameDialog, setShowRenameDialog] = useState(false)
	const [showDropDialog, setShowDropDialog] = useState(false)
	const [targetTableName, setTargetTableName] = useState<string>('')
	const [isDdlLoading, setIsDdlLoading] = useState(false)
	const [refreshTrigger, setRefreshTrigger] = useState(0)
	const [showTableInfoDialog, setShowTableInfoDialog] = useState(false)
	const [tableInfoTarget, setTableInfoTarget] = useState<string>('')
	const [bulkActionConfirm, setBulkActionConfirm] = useState<{
		open: boolean
		action: BulkAction | null
	}>({ open: false, action: null })
	const schemaFetchIdRef = useRef(0)

	useEffect(function initAppearance() {
		const settings = getAppearanceSettings()
		applyAppearanceToDOM(settings)
		if (settings.fontPair !== 'system') {
			loadFontPair(settings.fontPair)
		}
	}, [])

	useEffect(
		function handleAutoSelectFirstTable() {
			async function fetchSchema() {
				if (!activeConnectionId) {
					setSchema(null)
					setSchemaError(null)
					setSelectedSchema(undefined)
					setIsLoadingSchema(false)
					return
				}

				const requestId = ++schemaFetchIdRef.current
				setIsLoadingSchema(true)
				setSchemaError(null)

				try {
					const connectResult = await adapter.connectToDatabase(activeConnectionId)
					if (!connectResult.ok) {
						throw new Error(getAdapterError(connectResult))
					}

					const result = await adapter.getSchema(activeConnectionId)
					if (requestId !== schemaFetchIdRef.current) {
						return
					}
					if (result.ok) {
						setSchema(result.data)
						if (result.data.schemas.length > 0) {
							setSelectedSchema({
								id: result.data.schemas[0],
								name: result.data.schemas[0],
								databaseId: activeConnectionId
							})
						}

						if (
							autoSelectFirstTable &&
							result.data.tables.length > 0 &&
							onTableSelect
						) {
							const firstTable = result.data.tables[0]
							onTableSelect(firstTable.name, firstTable.name)
							if (onAutoSelectComplete) {
								onAutoSelectComplete()
							}
						}
					} else {
						throw new Error(getAdapterError(result))
					}
				} catch (error) {
					if (requestId !== schemaFetchIdRef.current) {
						return
					}
					console.error('Failed to fetch schema:', error)
					setSchemaError(error instanceof Error ? error.message : 'Failed to load schema')
					setSchema(null)
				} finally {
					if (requestId === schemaFetchIdRef.current) {
						setIsLoadingSchema(false)
					}
				}
			}

			fetchSchema()
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			activeConnectionId,
			refreshTrigger,
			autoSelectFirstTable
			// adapter is stable, onTableSelect and onAutoSelectComplete are useCallback with stable deps
		]
	)

	const tables = useMemo(
		function (): TableItem[] {
			if (!schema) return []
			return schema.tables.map(function (table: TableInfo) {
				return {
					id: table.name,
					name: table.name,
					rowCount: table.row_count_estimate ?? 0,
					type: 'table' as const
				}
			})
		},
		[schema]
	)

	const filteredTables = useMemo(
		function () {
			if (!schema) return []

			return tables
				.filter(function (table) {
					if (
						searchValue &&
						!table.name.toLowerCase().includes(searchValue.toLowerCase())
					) {
						return false
					}
					return true
				})
				.filter(function (table) {
					if (table.type === 'table' && !filters.showTables) return false
					if (table.type === 'view' && !filters.showViews) return false
					if (table.type === 'materialized-view' && !filters.showMaterializedViews)
						return false
					return true
				})
		},
		[schema, tables, searchValue, filters]
	)

	const activeTable = useMemo(
		function () {
			if (!schema || !activeTableId) return null
			return schema.tables.find(function (t) {
				return t.name === activeTableId
			})
		},
		[schema, activeTableId]
	)

	function handleTableSelect(tableId: string) {
		setInternalTableId(tableId)
		if (onTableSelect) {
			onTableSelect(tableId, tableId)
		}
	}

	function handleTableMultiSelect(tableId: string, checked: boolean) {
		if (checked) {
			setSelectedTableIds(function (prev) {
				return [...prev, tableId]
			})
		} else {
			setSelectedTableIds(function (prev) {
				return prev.filter(function (id) {
					return id !== tableId
				})
			})
		}
	}

	function handleContextAction(tableId: string, action: string) {
		handleRightClickAction(action as TableRightClickAction, tableId)
	}

	function handleRightClickAction(action: TableRightClickAction, tableId: string) {
		if (action === 'delete-table') {
			setTargetTableName(tableId)
			setShowDropDialog(true)
		} else if (action === 'edit-name') {
			setTargetTableName(tableId)
			setShowRenameDialog(true)
		} else if (action === 'copy-name') {
			navigator.clipboard.writeText(tableId)
			toast({
				title: 'Copied to clipboard',
				description: `Table name "${tableId}" copied.`
			})
		} else if (action === 'view-table') {
			handleTableSelect(tableId)
			handleNavSelect('database-studio')
		} else if (action === 'duplicate-table') {
			handleDuplicateTable(tableId)
		} else if (action === 'view-info') {
			setTableInfoTarget(tableId)
			setShowTableInfoDialog(true)
		} else if (action === 'export-schema') {
			handleExportTableSchema(tableId)
		} else if (action === 'export-json') {
			handleExportTableData(tableId, 'json')
		} else if (action === 'export-sql') {
			handleExportTableData(tableId, 'sql_insert')
		} else {
			console.log('Right-click action:', action, tableId)
		}
	}

	async function handleRenameTable(newName: string) {
		if (!activeConnectionId || !targetTableName) return

		setIsDdlLoading(true)
		try {
			const sql = `ALTER TABLE "${targetTableName}" RENAME TO "${newName}"`
			const result = await commands.executeBatch(activeConnectionId, [sql])
			if (result.status === 'ok') {
				setShowRenameDialog(false)
				setSchema(null)
				setRefreshTrigger(function (prev) {
					return prev + 1
				})
			} else {
				console.error('Failed to rename table:', result.error)
			}
		} catch (error) {
			console.error('Failed to rename table:', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	async function handleDropTable() {
		if (!activeConnectionId || !targetTableName) return

		setIsDdlLoading(true)
		try {
			const result = await adapter.dropTable(activeConnectionId, targetTableName)
			if (result.ok) {
				setShowDropDialog(false)
				setSchema(null)
				setRefreshTrigger(function (prev) {
					return prev + 1
				})
				if (activeTableId === targetTableName) {
					setInternalTableId(undefined)
				}
				toast({ title: 'Table dropped', description: `"${targetTableName}" has been removed.` })
			} else {
				const errorMessage = getAdapterError(result)
				console.error('Failed to drop table:', errorMessage)
				toast({
					title: 'Failed to drop table',
					description: errorMessage,
					variant: 'destructive'
				})
			}
		} catch (error) {
			console.error('Failed to drop table:', error)
			toast({ title: 'Failed to drop table', description: String(error), variant: 'destructive' })
		} finally {
			setIsDdlLoading(false)
		}
	}

	function handleTableRename(tableId: string, newName: string) {
		setTargetTableName(tableId)
		handleRenameTable(newName)
	}

	async function handleDuplicateTable(tableName: string) {
		if (!activeConnectionId) return

		setIsDdlLoading(true)
		try {
			// Find a unique name
			let newName = `${tableName}_copy`
			let counter = 1
			while (
				schema?.tables.some(function (t) {
					return t.name === newName
				})
			) {
				counter++
				newName = `${tableName}_copy${counter}`
			}

			const sqlCreate = `CREATE TABLE "${newName}" (LIKE "${tableName}" INCLUDING ALL)`
			const sqlData = `INSERT INTO "${newName}" SELECT * FROM "${tableName}"`

			const result = await commands.executeBatch(activeConnectionId, [sqlCreate, sqlData])

			if (result.status === 'ok') {
				toast({
					title: 'Table duplicated',
					description: `Table "${tableName}" duplicated as "${newName}".`
				})
				setSchema(null)
				setRefreshTrigger(function (prev) {
					return prev + 1
				})
			} else {
				throw new Error(String(result.error))
			}
		} catch (error) {
			console.error('Failed to duplicate table:', error)
			toast({
				title: 'Error duplicating table',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		} finally {
			setIsDdlLoading(false)
		}
	}

	function handleBulkAction(action: BulkAction) {
		if (!activeConnectionId || selectedTableIds.length === 0) return

		if (action === 'drop' || action === 'truncate') {
			setBulkActionConfirm({ open: true, action })
		}
	}

	async function executeBulkAction() {
		if (!activeConnectionId || !bulkActionConfirm.action) return

		const action = bulkActionConfirm.action
		setBulkActionConfirm({ open: false, action: null })

		if (action === 'drop') {
			setIsDdlLoading(true)
			try {
				const drops = selectedTableIds.map(function (id) {
					return `DROP TABLE IF EXISTS "${id}"`
				})
				const result = await commands.executeBatch(activeConnectionId, drops)
				if (result.status === 'ok') {
					toast({
						title: 'Tables dropped',
						description: `Successfully dropped ${selectedTableIds.length} tables.`
					})
					setSelectedTableIds([])
					setIsMultiSelectMode(false)
					setSchema(null)
					setRefreshTrigger(function (prev) {
						return prev + 1
					})
				} else {
					throw new Error(String(result.error))
				}
			} catch (e) {
				console.error(e)
				toast({
					title: 'Error dropping tables',
					description: String(e),
					variant: 'destructive'
				})
			} finally {
				setIsDdlLoading(false)
			}
		} else if (action === 'truncate') {
			setIsDdlLoading(true)
			try {
				const deletes = selectedTableIds.map(function (id) {
					return `DELETE FROM "${id}"`
				})
				const result = await commands.executeBatch(activeConnectionId, deletes)
				if (result.status === 'ok') {
					toast({
						title: 'Tables truncated',
						description: `Successfully truncated ${selectedTableIds.length} tables.`
					})
					setSelectedTableIds([])
					setIsMultiSelectMode(false)
					setRefreshTrigger(function (prev) {
						return prev + 1
					})
				} else {
					throw new Error(String(result.error))
				}
			} catch (e) {
				toast({
					title: 'Error truncating tables',
					description: String(e),
					variant: 'destructive'
				})
			} finally {
				setIsDdlLoading(false)
			}
		}
	}

	async function handleExportTableSchema(tableName: string) {
		if (!activeConnectionId) return

		try {
			const schemaResult = await adapter.getSchema(activeConnectionId)
			if (!schemaResult.ok) throw new Error(getAdapterError(schemaResult))

			const table = schemaResult.data.tables.find(function (t) {
				return t.name === tableName
			})
			if (!table) throw new Error(`Table ${tableName} not found`)

			const ddl = `CREATE TABLE "${tableName}" (\n${table.columns
				.map(function (col) {
					let line = `  "${col.name}" ${col.data_type}`
					if (!col.is_nullable) line += ' NOT NULL'
					if (col.default_value) line += ` DEFAULT ${col.default_value}`
					return line
				})
				.join(',\n')}\n);`

			navigator.clipboard.writeText(ddl)
			toast({
				title: 'Schema copied',
				description: `DDL for table "${tableName}" copied to clipboard.`
			})
		} catch (error) {
			toast({
				title: 'Error exporting schema',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	async function handleExportTableData(tableName: string, format: 'json' | 'sql_insert') {
		if (!activeConnectionId) return

		try {
			const result = await commands.exportTable(
				activeConnectionId,
				tableName,
				null,
				format,
				null
			)
			if (result.status !== 'ok') throw new Error(String(result.error))

			navigator.clipboard.writeText(result.data)
			toast({
				title: 'Data exported',
				description: `Table "${tableName}" exported as ${format.toUpperCase()} to clipboard.`
			})
		} catch (error) {
			toast({
				title: 'Error exporting data',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	async function handleCopySchema() {
		if (!activeConnectionId) return

		try {
			const result = await adapter.getDatabaseDDL(activeConnectionId)
			if (result.ok) {
				navigator.clipboard.writeText(result.data)
				toast({
					title: 'Schema copied',
					description: 'Database schema DDL copied to clipboard.'
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			console.error('Failed to copy schema:', error)
			toast({
				title: 'Error copying schema',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	const [topPanelRatio, setTopPanelRatio] = useState(0.7)
	const [isResizing, setIsResizing] = useState(false)
	const sidebarRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isResizing) return

		const handleMouseMove = (e: MouseEvent) => {
			if (sidebarRef.current) {
				const rect = sidebarRef.current.getBoundingClientRect()
				const relativeY = e.clientY - rect.top
				// Calculate used space by header (approx 40px + padding)
				// We want ratio of the REMAINING space or total space? 
				// Total space is simpler.
				const newRatio = Math.max(0.2, Math.min(0.85, relativeY / rect.height))
				setTopPanelRatio(newRatio)
			}
		}

		const handleMouseUp = () => {
			setIsResizing(false)
			document.body.style.cursor = ''
		}

		document.body.style.cursor = 'row-resize'
		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)

		return () => {
			document.body.style.cursor = ''
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [isResizing])

	const availableSchemas =
		schema?.schemas.map(function (s) {
			return {
				id: s,
				name: s,
				databaseId: activeConnectionId || 'unknown'
			}
		}) || []

	return (
		<div
			ref={sidebarRef}
			className='relative flex flex-col h-full w-[244px] bg-sidebar border-r border-sidebar-border select-none'
		>
			<div className='flex flex-col shrink-0'>
				<div className='p-0'>
					<ConnectionSwitcher
						connections={connections}
						activeConnectionId={activeConnectionId}
						onConnectionSelect={onConnectionSelect}
						onAddConnection={onAddConnection}
						onManageConnections={onManageConnections}
						onViewConnection={onViewConnection}
						onEditConnection={onEditConnection}
						onDeleteConnection={onDeleteConnection}
					/>
				</div>
			</div>

			{schema && (
				<div className='flex flex-col gap-2 px-2 py-2 border-t border-sidebar-border shrink-0'>
					{availableSchemas.length > 1 && (
						<SchemaSelector
							schemas={availableSchemas}
							selectedSchema={selectedSchema}
							onSchemaChange={setSelectedSchema}
						/>
					)}

					<TableSearch
						searchValue={searchValue}
						onSearchChange={setSearchValue}
						filters={filters}
						onFiltersChange={setFilters}
						onRefresh={function () {
							if (activeConnectionId) {
								setRefreshTrigger(function (prev) {
									return prev + 1
								})
							}
						}}
					/>
				</div>
			)}

			<ScrollArea
				className={cn('min-h-0', !activeTable && 'flex-1')}
				style={activeTable ? { height: `${topPanelRatio * 100}%` } : undefined}
			>
				{isLoadingSchema && !schema ? (
					<SidebarTableSkeleton rows={8} />
				) : schemaError ? (
					<div className='flex flex-col items-center justify-center h-40 px-4 py-6 gap-3'>
						<div className='flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10'>
							<svg
								className='h-5 w-5 text-destructive'
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth={1.5}
								stroke='currentColor'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
								/>
							</svg>
						</div>
						<div className='text-center space-y-1'>
							<h4 className='text-xs font-medium text-foreground'>Connection failed</h4>
							<p className='text-xs text-muted-foreground max-w-[180px] leading-relaxed'>
								{schemaError}
							</p>
						</div>
						<Button
							variant='outline'
							size='sm'
							className='text-xs h-7 px-3 mt-1'
							onClick={function () {
								setRefreshTrigger(function (prev) {
									return prev + 1
								})
							}}
						>
							Try again
						</Button>
					</div>
				) : !schema ? (
					<div className='flex flex-col items-center justify-center h-32 text-muted-foreground px-4'>
						<DatabaseIcon className='h-8 w-8 mb-3 opacity-50' />
						<span className='text-xs text-center mb-2'>No database connected</span>
						<Button
							variant='outline'
							size='sm'
							onClick={onAddConnection}
							className='text-xs'
						>
							<Plus className='h-3 w-3 mr-1' />
							Add Connection
						</Button>
					</div>
				) : filteredTables.length === 0 ? (
					<div className='flex flex-col items-center justify-center h-32 text-muted-foreground'>
						<span className='text-xs'>No tables found</span>
					</div>
				) : (
					<div className='relative'>
						<TableList
							tables={filteredTables}
							activeTableId={activeTableId}
							selectedTableIds={selectedTableIds}
							isMultiSelectMode={isMultiSelectMode}
							activeSortingTableIds={[]}
							editingTableId={editingTableId}
							onTableSelect={handleTableSelect}
							onTableMultiSelect={handleTableMultiSelect}
							onContextAction={handleContextAction}
							onRightClickAction={handleRightClickAction}
							onTableRename={handleTableRename}
						/>
						{isLoadingSchema && (
							<div className='absolute right-2 top-2 rounded bg-sidebar-accent/90 px-2 py-0.5 text-[10px] text-muted-foreground'>
								Refreshing...
							</div>
						)}
					</div>
				)}
			</ScrollArea>

			{activeTable && (
				<>
					{/* Resizer Handle */}
					<div
						className='h-1.5 shrink-0 bg-sidebar-border/30 hover:bg-primary/20 cursor-row-resize flex items-center justify-center transition-colors z-20 -my-0.5'
						onMouseDown={(e) => {
							e.preventDefault()
							setIsResizing(true)
						}}
					>
						<div className='w-8 h-0.5 bg-sidebar-border rounded-full' />
					</div>

					<div className='flex-1 min-h-0 flex flex-col bg-sidebar overflow-hidden'>
						<SidebarBottomPanel table={activeTable} />
					</div>
				</>
			)}

			{isMultiSelectMode && selectedTableIds.length > 0 && (
				<ManageTablesDialog
					selectedCount={selectedTableIds.length}
					onAction={handleBulkAction}
					onClose={function () {
						setIsMultiSelectMode(false)
						setSelectedTableIds([])
						setInternalTableId(undefined)
					}}
				/>
			)}

			<BottomToolbar />

			<RenameTableDialog
				open={showRenameDialog}
				onOpenChange={setShowRenameDialog}
				currentName={targetTableName}
				onConfirm={handleRenameTable}
				isLoading={isDdlLoading}
			/>

			<DropTableDialog
				open={showDropDialog}
				onOpenChange={setShowDropDialog}
				tableName={targetTableName}
				onConfirm={handleDropTable}
				isLoading={isDdlLoading}
			/>

			{activeConnectionId && (
				<TableInfoDialog
					open={showTableInfoDialog}
					onOpenChange={setShowTableInfoDialog}
					tableName={tableInfoTarget}
					connectionId={activeConnectionId}
				/>
			)}

			<AlertDialog
				open={bulkActionConfirm.open}
				onOpenChange={(open) => {
					if (!open) setBulkActionConfirm({ open: false, action: null })
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{bulkActionConfirm.action === 'drop' ? 'Drop Tables' : 'Truncate Tables'}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{bulkActionConfirm.action === 'drop'
								? `Are you sure you want to drop ${selectedTableIds.length} table${selectedTableIds.length > 1 ? 's' : ''}? This action cannot be undone.`
								: `Are you sure you want to truncate ${selectedTableIds.length} table${selectedTableIds.length > 1 ? 's' : ''}? All data will be permanently deleted.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={executeBulkAction}
							className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
						>
							{bulkActionConfirm.action === 'drop' ? 'Drop' : 'Truncate'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

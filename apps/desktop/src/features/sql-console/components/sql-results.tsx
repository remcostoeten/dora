import Editor from '@monaco-editor/react'
import { Table2, Braces, Download, Copy, Trash2, CircleCheck, Database } from 'lucide-react'
import { useAsyncRowCount } from '../hooks/use-async-row-count'
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
import { useState, useRef, useEffect, useMemo } from 'react'
import { useDataMutation } from '@/core/data-provider'
import { useSettings } from '@/core/settings'
import { Button } from '@/shared/ui/button'
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator
} from '@/shared/ui/context-menu'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useToast } from '@/shared/ui/use-toast'
import { cn } from '@/shared/utils/cn'
import { SqlQueryResult, ResultViewMode } from '../types'

type Props = {
	result: SqlQueryResult | null
	viewMode: ResultViewMode
	onViewModeChange: (mode: ResultViewMode) => void
	onExport: () => void
	connectionId?: string
	showFilter?: boolean
	onRefresh?: () => void
	sourceTable?: string
}

type EditingCell = {
	rowData: Record<string, unknown>
	column: string
	originalValue: unknown
	value: string
}

export function SqlResults({
	result,
	viewMode,
	onViewModeChange,
	onExport,
	connectionId,
	showFilter,
	onRefresh,
	sourceTable
}: Props) {
	const asyncRowCount = useAsyncRowCount(
		connectionId,
		sourceTable || result?.sourceTable,
		!!result && !result.error && result.queryType === 'SELECT'
	)
	const { updateCell, deleteRows } = useDataMutation()
	const { settings } = useSettings()
	const { toast } = useToast()
	const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
	const [filterText, setFilterText] = useState('')
	const [rowToDelete, setRowToDelete] = useState<Record<string, unknown> | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const isSavingEditRef = useRef(false)

	useEffect(() => {
		if (editingCell && inputRef.current) {
			inputRef.current.focus()
		}
	}, [editingCell])

	const successMessage = useMemo(() => {
		if (!result || result.error) return null

		if (result.queryType === 'SELECT') {
			return 'Query executed successfully.'
		}

		const affected = result.affectedRows ?? result.rowCount
		if (typeof affected === 'number' && affected >= 0) {
			return `Statement executed successfully. ${affected} row${affected !== 1 ? 's' : ''} affected.`
		}

		return 'Statement executed successfully.'
	}, [result])

	function formatCellValue(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL'
		}
		if (typeof value === 'boolean') {
			return value ? 'TRUE' : 'FALSE'
		}
		if (typeof value === 'object') {
			return JSON.stringify(value)
		}
		return String(value)
	}

	function areCellValuesEqual(a: unknown, b: unknown): boolean {
		if (Object.is(a, b)) return true
		if (typeof a !== typeof b) return false
		if (a === null || b === null) return false
		if (Array.isArray(a) || Array.isArray(b)) {
			if (!Array.isArray(a) || !Array.isArray(b)) return false
			if (a.length !== b.length) return false
			return a.every(function (value, index) {
				return areCellValuesEqual(value, b[index])
			})
		}
		if (typeof a === 'object' && typeof b === 'object') {
			const aRecord = a as Record<string, unknown>
			const bRecord = b as Record<string, unknown>
			const aKeys = Object.keys(aRecord).sort()
			const bKeys = Object.keys(bRecord).sort()
			if (aKeys.length !== bKeys.length) return false
			return aKeys.every(function (key, index) {
				return key === bKeys[index] && areCellValuesEqual(aRecord[key], bRecord[key])
			})
		}
		return false
	}

	function normalizeCellValue(columnName: string, value: string): unknown {
		const column = result?.columnDefinitions?.find(function (definition) {
			return definition.name === columnName
		})
		if (!column) return value

		const type = column.type.toLowerCase()
		const trimmed = value.trim()
		const isIntegerType = type.includes('int') || type.includes('serial')
		const isFloatType =
			type.includes('float') ||
			type.includes('double') ||
			type.includes('decimal') ||
			type.includes('numeric')
		const isBooleanType = type.includes('bool')
		const isJsonType = type.includes('json')

		if (trimmed === '') {
			if (column.nullable) return null
			if (isIntegerType || isFloatType) return 0
			if (isBooleanType) return false
			return ''
		}

		if (isIntegerType) {
			const parsed = Number.parseInt(trimmed, 10)
			return Number.isNaN(parsed) ? (column.nullable ? null : 0) : parsed
		}

		if (isFloatType) {
			const parsed = Number.parseFloat(trimmed)
			return Number.isNaN(parsed) ? (column.nullable ? null : 0) : parsed
		}

		if (isBooleanType) {
			const normalized = trimmed.toLowerCase()
			return (
				normalized === 'true' ||
				normalized === '1' ||
				normalized === 't' ||
				normalized === 'yes' ||
				normalized === 'on'
			)
		}

		if (isJsonType) {
			try {
				return JSON.parse(trimmed)
			} catch {
				return value
			}
		}

		return value
	}

	function getPrimaryKey() {
		if (!result?.columnDefinitions) return null
		const primaryKeys = result.columnDefinitions.filter(function (column) {
			return column.primaryKey
		})
		if (primaryKeys.length !== 1) return null
		return primaryKeys[0]
	}

	const mutationContext = useMemo(() => {
		if (!result || !connectionId) return null

		const primaryKey = getPrimaryKey()
		const primaryKeyName =
			primaryKey?.name || result.columns.find((column) => column.toLowerCase() === 'id')

		if (!result.sourceTable || !primaryKeyName) {
			return null
		}

		return {
			tableName: result.sourceTable,
			primaryKeyName
		}
	}, [connectionId, result])

	const mutationDisabledReason = useMemo(() => {
		if (!result || !connectionId) {
			return 'Connect to a database to enable row mutations.'
		}

		if (!result.sourceTable) {
			return 'This result set is not tied to a single source table, so edit/delete is disabled.'
		}

		const primaryKeys = (result.columnDefinitions || []).filter(function (column) {
			return column.primaryKey
		})
		if (primaryKeys.length > 1) {
			return 'Composite primary keys are not yet supported for SQL result mutations.'
		}

		const primaryKey = getPrimaryKey()
		const primaryKeyName =
			primaryKey?.name || result.columns.find((column) => column.toLowerCase() === 'id')

		if (!primaryKeyName) {
			return 'No primary key metadata was found for this result set, so edit/delete is disabled.'
		}

		return null
	}, [connectionId, result])

	function handleCellDoubleClick(
		rowData: Record<string, unknown>,
		column: string,
		value: unknown
	) {
		if (!mutationContext) return

		isSavingEditRef.current = false
		setEditingCell({
			rowData,
			column,
			originalValue: value,
			value: value === null ? '' : String(value)
		})
	}

	async function handleSaveCell() {
		if (!editingCell || !result || !connectionId || !mutationContext) return
		if (isSavingEditRef.current) return
		isSavingEditRef.current = true

		const row = editingCell.rowData
		const pkValue = row[mutationContext.primaryKeyName]
		const normalizedNewValue = normalizeCellValue(editingCell.column, editingCell.value)

		if (pkValue === undefined) {
			toast({
				title: 'Failed to update cell',
				description: 'Primary key value was not found for this row.',
				variant: 'destructive'
			})
			setEditingCell(null)
			return
		}

		if (areCellValuesEqual(editingCell.originalValue, normalizedNewValue)) {
			setEditingCell(null)
			return
		}

		try {
			updateCell.mutate(
				{
					connectionId,
					tableName: mutationContext.tableName,
					primaryKeyColumn: mutationContext.primaryKeyName,
					primaryKeyValue: pkValue,
					columnName: editingCell.column,
					newValue: normalizedNewValue
				},
				{
					onError: (e) => {
						toast({
							title: 'Failed to update cell',
							description: e instanceof Error ? e.message : 'An error occurred',
							variant: 'destructive'
						})
					},
					onSuccess: () => {
						onRefresh?.()
					}
				}
			)

			setEditingCell(null)
		} catch (e) {
			toast({
				title: 'Failed to update cell',
				description: e instanceof Error ? e.message : 'An error occurred',
				variant: 'destructive'
			})
		}
	}

	function handleDeleteRow(rowData: Record<string, unknown>) {
		if (!mutationContext) return

		if (settings.confirmBeforeDelete) {
			setRowToDelete(rowData)
		} else {
			performDeleteRow(rowData)
		}
	}

	async function performDeleteRow(rowData: Record<string, unknown>) {
		if (!result || !connectionId || !mutationContext) return
		const pkValue = rowData[mutationContext.primaryKeyName]

		if (pkValue === undefined) {
			toast({
				title: 'Failed to delete row',
				description: 'Primary key value was not found for this row.',
				variant: 'destructive'
			})
			return
		}

		deleteRows.mutate(
			{
				connectionId,
				tableName: mutationContext.tableName,
				primaryKeyColumn: mutationContext.primaryKeyName,
				primaryKeyValues: [pkValue]
			},
			{
				onError: (e) => {
					toast({
						title: 'Failed to delete row',
						description: e instanceof Error ? e.message : 'An error occurred',
						variant: 'destructive'
					})
				},
				onSuccess: () => {
					onRefresh?.()
					setRowToDelete(null)
				}
			}
		)
	}

	const { filteredRows, filterTime } = useMemo(() => {
		if (!result) return { filteredRows: [], filterTime: 0 }
		const start = performance.now()
		const rows = result.rows.filter((row) => {
			if (!filterText) return true
			const lowerFilter = filterText.toLowerCase()
			return Object.values(row).some((val) => String(val).toLowerCase().includes(lowerFilter))
		})
		const end = performance.now()
		return { filteredRows: rows, filterTime: (end - start).toFixed(2) }
	}, [result, filterText])

	// Reset filter if hidden
	useEffect(() => {
		if (!showFilter) setFilterText('')
	}, [showFilter])

	return (
		<div className='flex flex-col h-full bg-background'>
			<div className='flex items-center justify-between h-8 px-2 border-b border-sidebar-border bg-sidebar-accent/30 shrink-0'>
				<div className='flex items-center gap-0.5'>
					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-6 w-6',
							viewMode === 'table'
								? 'bg-sidebar-accent text-sidebar-foreground'
								: 'text-muted-foreground hover:text-sidebar-foreground'
						)}
						onClick={() => onViewModeChange('table')}
						title='Table view'
					>
						<Table2 className='h-3.5 w-3.5' />
					</Button>
					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-6 w-6',
							viewMode === 'json'
								? 'bg-sidebar-accent text-sidebar-foreground'
								: 'text-muted-foreground hover:text-sidebar-foreground'
						)}
						onClick={() => onViewModeChange('json')}
						title='JSON view'
					>
						<Braces className='h-3.5 w-3.5' />
					</Button>
				</div>

				{result && !result.error && (
					<div className='flex items-center gap-2 text-xs'>
						<span className='inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400'>
							<CircleCheck className='h-3 w-3' />
							Success
						</span>
						<span className='text-muted-foreground'>
							{successMessage}{' '}
							{filteredRows.length !== result.rowCount
								? `${filteredRows.length} / `
								: ''}
							{result.rowCount} row{result.rowCount !== 1 ? 's' : ''} •{' '}
							{result.executionTime}ms backend • {filterTime}ms filtering
						</span>
						{(sourceTable || result.sourceTable) && (
							<span className='inline-flex items-center gap-1.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-0.5 text-muted-foreground transition-all duration-300'>
								<Database className='h-3 w-3 shrink-0' />
								<span className='font-mono text-[11px]'>
									{sourceTable || result.sourceTable}
								</span>
								<span className='font-mono text-[11px]'>:</span>
								{asyncRowCount.isLoading ? (
									<span className='async-count-shimmer inline-block h-3 w-10 rounded-sm' />
								) : asyncRowCount.count !== null ? (
									<span className='async-count-reveal font-mono text-[11px] font-medium text-foreground'>
										{asyncRowCount.count.toLocaleString()}
									</span>
								) : (
									<span className='font-mono text-[11px] opacity-50'>~</span>
								)}
								<span className='text-[10px] opacity-60'>rows</span>
							</span>
						)}
					</div>
				)}

				{mutationDisabledReason && result && !result.error && result.rows.length > 0 && (
					<div className='text-[11px] text-muted-foreground'>
						{mutationDisabledReason}
					</div>
				)}

				<Button
					variant='ghost'
					size='icon'
					className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
					onClick={onExport}
					disabled={!result || result.rows.length === 0}
					title='Export results'
				>
					<Download className='h-3.5 w-3.5' />
				</Button>
			</div>

			<div className='flex-1 overflow-hidden'>
				{!result ? (
					<div className='flex items-center justify-center h-full text-muted-foreground text-sm'>
						Run a query to see results
					</div>
				) : result.error ? (
					<div className='flex items-center justify-center h-full p-4'>
						<div className='text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20 max-w-lg'>
							{result.error}
						</div>
					</div>
				) : result.rows.length === 0 ? (
					<div className='flex flex-col items-center justify-center h-full text-muted-foreground'>
						<div className='inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400'>
							<CircleCheck className='h-4 w-4' />
							<span className='text-sm'>
								{successMessage || 'Statement executed successfully.'}
							</span>
						</div>
					</div>
				) : viewMode === 'json' ? (
					<div className='relative h-full w-full'>
						<Editor
							height='100%'
							defaultLanguage='json'
							value={JSON.stringify(result.rows, null, 2)}
							theme='vs-dark'
							options={{
								readOnly: true,
								minimap: { enabled: false },
								fontSize: 13,
								lineNumbers: 'on',
								scrollBeyondLastLine: false,
								automaticLayout: true,
								tabSize: 2,
								folding: true,
								wordWrap: 'on',
								padding: { top: 12, bottom: 12 },
								renderLineHighlight: 'none',
								fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
							}}
						/>
						<Button
							variant='ghost'
							size='icon'
							className='absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-xs border border-border hover:bg-background'
							onClick={() =>
								navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2))
							}
							title='Copy JSON'
						>
							<Copy className='h-3.5 w-3.5' />
						</Button>
					</div>
				) : (
					<div className='flex flex-col h-full'>
						{showFilter && (
							<div className='p-2 border-b border-sidebar-border bg-sidebar-accent/10'>
								<Input
									placeholder='Filter results...'
									value={filterText}
									onChange={(e) => setFilterText(e.target.value)}
									className='h-7 text-xs'
									autoFocus
								/>
							</div>
						)}
						<ScrollArea className='flex-1'>
							<table className='w-full text-sm'>
								<thead className='sticky top-0 bg-sidebar-accent z-10'>
									<tr>
										<th className='w-8 px-2 py-1.5 text-center text-muted-foreground border-b border-r border-sidebar-border'>
											#
										</th>
										{result.columns.map((col) => (
											<th
												key={col}
												className='px-3 py-1.5 text-left font-medium text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 whitespace-nowrap'
											>
												{col}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{filteredRows.map((row, rowIndex) => (
										<ContextMenu key={rowIndex}>
											<ContextMenuTrigger asChild>
												<tr className='hover:bg-sidebar-accent/50 transition-colors group'>
													<td className='px-2 py-1.5 text-center text-xs text-muted-foreground border-b border-r border-sidebar-border group-hover:bg-sidebar-accent'>
														{rowIndex + 1}
													</td>
													{result.columns.map((col) => {
														const isEditing =
															editingCell?.rowData === row &&
															editingCell?.column === col
														const cellValue = row[col]

														return (
															<td
																key={col}
																className={cn(
																	'px-3 py-1.5 text-sidebar-foreground border-b border-r border-sidebar-border last:border-r-0 font-mono whitespace-nowrap relative min-h-[30px]',
																	mutationContext
																		? 'cursor-cell'
																		: 'cursor-default'
																)}
																onDoubleClick={() => {
																	if (!mutationContext) return
																	handleCellDoubleClick(
																		row,
																		col,
																		cellValue
																	)
																}}
															>
																{isEditing ? (
																	<Input
																		ref={inputRef}
																		className='h-6 w-full min-w-[100px] px-1 py-0 text-sm font-mono bg-background border-primary absolute inset-0 rounded-none z-20'
																		value={editingCell.value}
																		onChange={(e) =>
																			setEditingCell({
																				...editingCell,
																				value: e.target
																					.value
																			})
																		}
																		onBlur={async () => {
																			await handleSaveCell()
																		}}
																		onKeyDown={async (e) => {
																			if (e.key === 'Enter') {
																				e.preventDefault()
																				e.stopPropagation()
																				await handleSaveCell()
																			} else if (
																				e.key === 'Escape'
																			) {
																				isSavingEditRef.current = false
																				setEditingCell(null)
																			}
																		}}
																	/>
																) : (
																	<div
																		className='truncate max-w-[300px]'
																		title={formatCellValue(
																			cellValue
																		)}
																	>
																		{formatCellValue(cellValue)}
																	</div>
																)}
															</td>
														)
													})}
												</tr>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem
													onClick={() =>
														navigator.clipboard.writeText(
															JSON.stringify(row, null, 2)
														)
													}
												>
													<Copy className='mr-2 h-4 w-4' />
													Copy Row JSON
												</ContextMenuItem>
												<ContextMenuSeparator />
												<ContextMenuItem
													disabled={!mutationContext}
													className='text-destructive focus:text-destructive'
													onClick={() => handleDeleteRow(row)}
												>
													<Trash2 className='mr-2 h-4 w-4' />
													Delete Row
												</ContextMenuItem>
											</ContextMenuContent>
										</ContextMenu>
									))}
								</tbody>
							</table>
						</ScrollArea>
					</div>
				)}
			</div>

			<AlertDialog
				open={rowToDelete !== null}
				onOpenChange={(open) => !open && setRowToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Row?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the selected
							row.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault()
								if (rowToDelete !== null) {
									performDeleteRow(rowToDelete)
								}
							}}
							className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

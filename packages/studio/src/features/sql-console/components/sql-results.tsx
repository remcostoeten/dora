import Editor from '@monaco-editor/react'
import { Table2, Braces, Download, Copy, Trash2, CircleCheck, Database, BarChart3, Sparkles } from 'lucide-react'
import { askAi, buildFixErrorPrompt } from '@studio/features/ai-assistant/ai-actions'
import { QueryPlanPanel, isExplainQuery } from './query-plan-panel'
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
} from '@studio/shared/ui/alert-dialog'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useDataMutation } from '@studio/core/data-provider'
import { useSettings } from '@studio/core/settings'
import { MASK_TOKEN, maskRowsForJson } from '@studio/core/privacy/mask'
import { Button } from '@studio/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator
} from '@studio/shared/ui/context-menu'
import { Input } from '@studio/shared/ui/input'
import { ScrollArea } from '@studio/shared/ui/scroll-area'
import { useToast } from '@studio/shared/ui/use-toast'
import { remeasureMonacoFonts } from '@studio/shared/lib/font-loader'
import { cn } from '@studio/shared/utils/cn'
import { areValuesEqual } from '@studio/shared/utils/value-equality'
import { ResultChartPanel } from '@studio/features/result-charts/result-chart-panel'
import type { ResultChartConfig } from '@studio/features/result-charts/types'
import { formatCellValue as renderCellValue } from '@studio/features/database-studio/components/data-grid/cell-value'
import type { ColumnDefinition } from '@studio/features/database-studio/types'
import { inferColumnDefinitions } from '../lib/infer-column-definitions'
import { SqlQueryResult, ResultViewMode } from '../types'

type Props = {
	result: SqlQueryResult | null
	viewMode: ResultViewMode
	onViewModeChange: (mode: ResultViewMode) => void
	onExport: () => void
	chartConfig: ResultChartConfig | null
	onChartConfigChange: (config: ResultChartConfig) => void
	connectionId?: string
	showFilter?: boolean
	onRefresh?: () => void
	sourceTable?: string
	query?: string
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
	chartConfig,
	onChartConfigChange,
	connectionId,
	showFilter,
	onRefresh,
	sourceTable,
	query
}: Props) {
	const asyncRowCount = useAsyncRowCount(
		connectionId,
		sourceTable || result?.sourceTable,
		!!result && !result.error && result.queryType === 'SELECT'
	)
	const { updateCell, deleteRows } = useDataMutation()
	const { settings } = useSettings()
	const masked = settings.privacyMaskData
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

	// In privacy mode the JSON view must not leak raw values either, so mask the
	// rows before serializing.
	const resultJsonText = useMemo(() => {
		if (!result) return ''
		const rows = masked ? maskRowsForJson(result.rows) : result.rows
		return JSON.stringify(rows, null, 2)
	}, [result, masked])

	const cellColumns = useMemo(() => {
		if (!result) return new Map<string, ColumnDefinition>()
		return inferColumnDefinitions(result.columns, result.rows, result.columnDefinitions)
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

	function normalizeCellValue(columnName: string, value: string): unknown {
		const column = result?.columnDefinitions?.find(function (definition) {
			return definition.name === columnName
		})
		if (!column) return value

		const type = (column.type ?? '').toLowerCase()
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

		try {
			if (pkValue === undefined) {
				toast({
					title: 'Failed to update cell',
					description: 'Primary key value was not found for this row.',
					variant: 'destructive'
				})
				return
			}

			if (areValuesEqual(editingCell.originalValue, normalizedNewValue)) {
				return
			}

			await updateCell.mutateAsync({
				connectionId,
				tableName: mutationContext.tableName,
				primaryKeyColumn: mutationContext.primaryKeyName,
				primaryKeyValue: pkValue,
				columnName: editingCell.column,
				newValue: normalizedNewValue
			})
			onRefresh?.()
		} catch (e) {
			toast({
				title: 'Failed to update cell',
				description: e instanceof Error ? e.message : 'An error occurred',
				variant: 'destructive'
			})
		} finally {
			isSavingEditRef.current = false
			setEditingCell(null)
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
					<Tooltip>
						<TooltipTrigger asChild>
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
								aria-label='Table view'
							>
								<Table2 className='h-3.5 w-3.5' />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Table view</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
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
								aria-label='JSON view'
							>
								<Braces className='h-3.5 w-3.5' />
							</Button>
						</TooltipTrigger>
						<TooltipContent>JSON view</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant='ghost'
								size='icon'
								className={cn(
									'h-6 w-6',
									viewMode === 'chart'
										? 'bg-sidebar-accent text-sidebar-foreground'
										: 'text-muted-foreground hover:text-sidebar-foreground'
								)}
								onClick={() => onViewModeChange('chart')}
								aria-label='Chart view'
							>
								<BarChart3 className='h-3.5 w-3.5' />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Chart view</TooltipContent>
					</Tooltip>
					{result && !result.error && (
						<span className='ml-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400'>
							<CircleCheck className='h-3 w-3' />
							Success
						</span>
					)}
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='ghost'
							size='icon'
							className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
							onClick={onExport}
							disabled={!result || result.rows.length === 0 || masked}
							aria-label='Export results'
						>
							<Download className='h-3.5 w-3.5' />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Export results</TooltipContent>
				</Tooltip>
			</div>

			<div className='flex-1 overflow-hidden'>
				{!result ? (
					<div className='flex items-center justify-center h-full text-muted-foreground text-sm'>
						Run a query to see results
					</div>
				) : result.error ? (
					<div className='flex items-center justify-center h-full p-4'>
						<div className='flex flex-col gap-2 max-w-lg'>
							<div className='text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20'>
								{result.error}
							</div>
							{query?.trim() && (
								<Button
									variant='outline'
									size='sm'
									className='h-7 gap-1.5 self-start text-xs'
									onClick={function () {
										askAi(buildFixErrorPrompt(query, result.error ?? ''))
									}}
								>
									<Sparkles className='h-3.5 w-3.5' />
									Fix with AI
								</Button>
							)}
						</div>
					</div>
				) : isExplainQuery(result.executedQuery) ? (
					<QueryPlanPanel result={result} />
				) : viewMode === 'chart' ? (
					<ResultChartPanel
						columns={result.columns.map(function (column) {
							const definition = result.columnDefinitions?.find(function (item) {
								return item.name === column
							})
							return { name: column, type: definition?.type }
						})}
						rows={result.rows}
						config={chartConfig}
						onConfigChange={onChartConfigChange}
						title='Query chart'
					/>
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
							value={resultJsonText}
							theme='vs-dark'
							onMount={(_editor, monaco) => remeasureMonacoFonts(monaco)}
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
							onClick={() => navigator.clipboard.writeText(resultJsonText)}
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
																	mutationContext && !masked
																		? 'cursor-cell'
																		: 'cursor-default'
																)}
																onDoubleClick={() => {
																	if (!mutationContext || masked) return
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
																) : masked ? (
																	<div className='truncate max-w-[300px]'>
																		<span className='select-none tracking-widest text-muted-foreground'>
																			{MASK_TOKEN}
																		</span>
																	</div>
																) : (
																	<div
																		className='truncate max-w-[300px]'
																		title={formatCellValue(
																			cellValue
																		)}
																	>
																		{renderCellValue(
																			cellValue,
																			cellColumns.get(col) ?? {
																				name: col,
																				type: 'text',
																				nullable: true,
																				primaryKey: false
																			}
																		)}
																	</div>
																)}
															</td>
														)
													})}
												</tr>
											</ContextMenuTrigger>
											<ContextMenuContent>
												<ContextMenuItem
													disabled={masked}
													onClick={() => {
														if (masked) return
														navigator.clipboard.writeText(
															JSON.stringify(row, null, 2)
														)
													}}
												>
													<Copy />
													Copy Row JSON
												</ContextMenuItem>
												<ContextMenuSeparator />
												<ContextMenuItem
													disabled={!mutationContext || masked}
													variant='destructive'
													onClick={() => handleDeleteRow(row)}
												>
													<Trash2 />
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

			{result && !result.error && (
				<div className='flex items-center justify-between gap-3 px-2 py-1.5 border-t border-sidebar-border bg-sidebar-accent/20 shrink-0 text-xs'>
					<div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground'>
						<span>
							{successMessage}{' '}
							{filteredRows.length !== result.rowCount ? `${filteredRows.length} / ` : ''}
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
					{mutationDisabledReason && result.rows.length > 0 && (
						<span className='shrink-0 text-[11px] text-muted-foreground'>
							{mutationDisabledReason}
						</span>
					)}
				</div>
			)}

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

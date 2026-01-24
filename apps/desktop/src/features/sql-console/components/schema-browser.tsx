import {
	Search,
	Table2,
	Eye,
	ChevronRight,
	ChevronDown,
	Key,
	Hash,
	Type,
	Calendar,
	ToggleLeft,
	Copy,
	Database,
	FileText
} from 'lucide-react'
import { useState, useCallback } from 'react'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	ContextMenuSeparator
} from '@/shared/ui/context-menu'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { cn } from '@/shared/utils/cn'
import { TableInfo } from '../types'

type Props = {
	tables: TableInfo[]
	onTableSelect?: (tableName: string) => void
	onInsertQuery?: (query: string) => void
}

function formatRowCount(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(count >= 10000 ? 1 : 2).replace(/\.?0+$/, '')}K`
	}
	return count.toString()
}

function ColumnIcon({ type, isPrimaryKey }: { type: string; isPrimaryKey?: boolean }) {
	if (isPrimaryKey) return <Key className='h-3 w-3 text-yellow-500/80' />
	if (type.includes('int') || type.includes('serial') || type.includes('decimal'))
		return <Hash className='h-3 w-3 text-blue-400' />
	if (type.includes('char') || type.includes('text'))
		return <Type className='h-3 w-3 text-green-400' />
	if (type.includes('date') || type.includes('time'))
		return <Calendar className='h-3 w-3 text-orange-400' />
	if (type.includes('bool')) return <ToggleLeft className='h-3 w-3 text-purple-400' />
	return <div className='h-3 w-3 rounded-full bg-slate-500/30' />
}

export function SchemaBrowser({ tables, onTableSelect, onInsertQuery }: Props) {
	const [searchValue, setSearchValue] = useState('')
	const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

	function toggleTable(tableName: string) {
		const next = new Set(expandedTables)
		if (next.has(tableName)) {
			next.delete(tableName)
		} else {
			next.add(tableName)
		}
		setExpandedTables(next)
	}

	const copyToClipboard = useCallback((text: string) => {
		navigator.clipboard.writeText(text)
	}, [])

	const filteredTables = tables.filter((t) =>
		t.name.toLowerCase().includes(searchValue.toLowerCase())
	)

	return (
		<div className='flex flex-col h-full w-full border-l border-sidebar-border bg-sidebar'>
			{/* Search */}
			<div className='p-2 border-b border-sidebar-border'>
				<div className='relative'>
					<Search className='absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70' />
					<Input
						placeholder='Search tables...'
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						className='h-7 bg-transparent border-sidebar-border/60 text-xs pl-7'
					/>
				</div>
			</div>

			{/* Tables list */}
			<ScrollArea className='flex-1'>
				<div className='py-1'>
					{filteredTables.map((table) => {
						const isExpanded = expandedTables.has(table.name)
						const hasColumns = table.columns && table.columns.length > 0

						return (
							<div key={table.name} className='flex flex-col'>
								<ContextMenu>
									<ContextMenuTrigger>
										<div className='flex items-center group w-full px-2 py-1 hover:bg-sidebar-accent/50 transition-colors'>
											<button
												onClick={() => toggleTable(table.name)}
												className={cn(
													'p-0.5 rounded-sm hover:bg-sidebar-accent mr-1 transition-transform',
													!hasColumns && 'opacity-0 pointer-events-none'
												)}
											>
												{isExpanded ? (
													<ChevronDown className='h-3 w-3 text-muted-foreground' />
												) : (
													<ChevronRight className='h-3 w-3 text-muted-foreground' />
												)}
											</button>

											<button
												className='flex-1 flex items-center gap-2 text-sm text-left overflow-hidden'
												onClick={() => onTableSelect?.(table.name)}
												title={`INSERT table: ${table.name}`}
											>
												{table.type === 'view' ? (
													<Eye className='h-4 w-4 text-muted-foreground shrink-0' />
												) : (
													<Table2 className='h-4 w-4 text-muted-foreground shrink-0' />
												)}
												<span className='truncate text-sidebar-foreground'>
													{table.name}
												</span>
											</button>

											<span className='text-[10px] text-muted-foreground tabular-nums ml-2'>
												{formatRowCount(table.rowCount)}
											</span>
										</div>
									</ContextMenuTrigger>
									<ContextMenuContent>
										<ContextMenuItem
											onClick={() =>
												onInsertQuery?.(
													`SELECT * FROM ${table.name} LIMIT 100;`
												)
											}
										>
											<Database className='h-3.5 w-3.5' />
											SELECT * FROM {table.name}
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() =>
												onInsertQuery?.(
													`SELECT COUNT(*) FROM ${table.name};`
												)
											}
										>
											<FileText className='h-3.5 w-3.5' />
											COUNT rows
										</ContextMenuItem>
										<ContextMenuSeparator />
										<ContextMenuItem
											onClick={() => copyToClipboard(table.name)}
										>
											<Copy className='h-3.5 w-3.5' />
											Copy table name
										</ContextMenuItem>
									</ContextMenuContent>
								</ContextMenu>

								{/* Columns list */}
								{isExpanded && hasColumns && (
									<div className='pl-9 pb-1 space-y-0.5 relative'>
										{/* Guide line */}
										<div className='absolute left-[19px] top-0 bottom-2 w-px bg-border/40' />

										{table.columns?.map((col) => (
											<ContextMenu key={`${table.name}-${col.name}`}>
												<ContextMenuTrigger>
													<div
														className='flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/30 rounded-sm cursor-pointer relative group/col'
														title={`${col.name} (${col.type})`}
													>
														<ColumnIcon
															type={col.type}
															isPrimaryKey={col.primaryKey}
														/>
														<span
															className={cn(
																'truncate',
																col.primaryKey &&
																	'font-medium text-foreground'
															)}
														>
															{col.name}
														</span>
														<span className='text-[10px] text-muted-foreground/50 ml-auto font-mono'>
															{col.type}
														</span>
													</div>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuItem
														onClick={() => onInsertQuery?.(col.name)}
													>
														<FileText className='h-3.5 w-3.5' />
														Insert column name
													</ContextMenuItem>
													<ContextMenuItem
														onClick={() =>
															onInsertQuery?.(
																`SELECT ${col.name} FROM ${table.name} LIMIT 100;`
															)
														}
													>
														<Database className='h-3.5 w-3.5' />
														SELECT {col.name}
													</ContextMenuItem>
													<ContextMenuSeparator />
													<ContextMenuItem
														onClick={() => copyToClipboard(col.name)}
													>
														<Copy className='h-3.5 w-3.5' />
														Copy column name
													</ContextMenuItem>
													<ContextMenuItem
														onClick={() => copyToClipboard(col.type)}
													>
														<Copy className='h-3.5 w-3.5' />
														Copy type: {col.type}
													</ContextMenuItem>
												</ContextMenuContent>
											</ContextMenu>
										))}
									</div>
								)}
							</div>
						)
					})}
				</div>
			</ScrollArea>
		</div>
	)
}

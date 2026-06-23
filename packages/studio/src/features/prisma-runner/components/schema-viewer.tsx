import { Box, ChevronRight, ChevronDown, CornerDownRight, KeyRound, Link2 } from 'lucide-react'
import { useState } from 'react'
import type { DatabaseSchema, ColumnInfo } from '@studio/lib/bindings'
import { ScrollArea } from '@studio/shared/ui/scroll-area'
import { cn } from '@studio/shared/utils/cn'
import { tableToModelKey, tableToModelName } from '../utils/model-mapper'

type Props = {
	schema: DatabaseSchema
	onInsert: (text: string) => void
}

type TsKind = 'number' | 'string' | 'boolean' | 'Date' | 'unknown'

function tsType(column: ColumnInfo): TsKind {
	const type = column.data_type.toLowerCase()
	if (/int|serial|decimal|double|float|numeric|real/.test(type)) return 'number'
	if (/bool/.test(type)) return 'boolean'
	if (/timestamp|date|time/.test(type)) return 'Date'
	if (/char|text|uuid|json|enum/.test(type)) return 'string'
	return 'unknown'
}

export function SchemaViewer({ schema, onInsert }: Props) {
	const tables = schema.tables
	const [expandedTable, setExpandedTable] = useState<string | null>(tables[0]?.name || null)

	return (
		<ScrollArea className='h-full bg-sidebar'>
			<div className='p-2 space-y-1'>
				{tables.map(function (table) {
					const modelKey = tableToModelKey(table.name)
					const modelName = tableToModelName(table.name)
					const relations = table.columns.filter(function (c) {
						return c.foreign_key != null
					})
					return (
						<div key={table.name} className='rounded-md overflow-hidden'>
							<button
								className={cn(
									'flex items-center gap-2 w-full px-2 py-1.5 text-left transition-colors text-sm rounded-md',
									expandedTable === table.name
										? 'bg-sidebar-accent text-sidebar-foreground'
										: 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
								)}
								onClick={function () {
									setExpandedTable(expandedTable === table.name ? null : table.name)
								}}
								onDoubleClick={function () {
									onInsert(`prisma.${modelKey}`)
								}}
							>
								{expandedTable === table.name ? (
									<ChevronDown className='h-3.5 w-3.5 opacity-50' />
								) : (
									<ChevronRight className='h-3.5 w-3.5 opacity-50' />
								)}
								<Box className='h-4 w-4 shrink-0 opacity-70' />
								<span className='font-medium truncate'>{modelName}</span>
								<span className='ml-auto shrink-0 rounded bg-sidebar-accent/40 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/70'>
									{table.columns.length}
								</span>
							</button>

							{expandedTable === table.name && (
								<div className='ml-4 pl-2 border-l border-sidebar-border/50 my-1 space-y-0.5'>
									{table.columns.map(function (col) {
										return (
											<button
												key={col.name}
												className='flex items-center gap-2 w-full rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors text-left'
												onClick={function () {
													onInsert(`prisma.${modelKey}`)
												}}
											>
												{col.is_primary_key ? (
													<KeyRound className='h-3 w-3 shrink-0 text-amber-400/80' />
												) : col.foreign_key ? (
													<Link2 className='h-3 w-3 shrink-0 text-sky-400/70' />
												) : (
													<span className='h-1 w-1 shrink-0 rounded-full bg-muted-foreground/30' />
												)}
												<span className='font-mono flex-1 truncate'>{col.name}</span>
												<span className='shrink-0 rounded bg-sidebar-accent/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80'>
													{tsType(col)}
													{col.is_nullable ? '?' : ''}
												</span>
											</button>
										)
									})}

									{relations.length > 0 && (
										<div className='pt-1 mt-1 border-t border-sidebar-border/30 space-y-0.5'>
											{relations.map(function (col) {
												const fk = col.foreign_key
												if (!fk) return null
												const relatedKey = tableToModelKey(fk.referenced_table)
												const relatedName = tableToModelName(fk.referenced_table)
												return (
													<button
														key={`fk-${col.name}`}
														className='flex items-center gap-1.5 w-full px-2 py-1 text-xs text-muted-foreground/80 hover:text-sidebar-foreground transition-colors text-left'
														onClick={function () {
															onInsert(`prisma.${relatedKey}`)
														}}
													>
														<CornerDownRight className='h-3 w-3 shrink-0 opacity-50' />
														<span className='font-mono truncate'>{relatedKey}</span>
														<span className='font-mono text-[10px] text-muted-foreground/50'>
															{relatedName}
														</span>
													</button>
												)
											})}
										</div>
									)}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</ScrollArea>
	)
}

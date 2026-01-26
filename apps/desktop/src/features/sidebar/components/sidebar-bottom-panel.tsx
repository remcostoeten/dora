import { Key, Link, Hash, Type, TextQuote, Lock, Calendar, Layers, Check } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Badge } from '@/shared/ui/badge'
import { TableInfo } from '@/lib/bindings'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

// Temporary type extension until bindings are regenerated
type IndexInfo = {
	name: string
	column_names: string[]
	is_unique: boolean
	is_primary: boolean
}

type ExtendedTableInfo = TableInfo & {
	indexes?: IndexInfo[]
}

type Props = {
	table: ExtendedTableInfo
}

function getColumnIcon(type: string, isPk?: boolean, isFk?: boolean) {
	if (isPk) return Key
	if (isFk) return Link

	const t = type.toLowerCase()
	if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('serial'))
		return Hash
	if (t.includes('char') || t.includes('text')) return Type
	if (t.includes('date') || t.includes('time') || t.includes('year')) return Calendar
	if (t.includes('bool')) return Lock

	return TextQuote
}

function getColumnTooltip(type: string, isPk?: boolean, isFk?: boolean): string {
	if (isPk) return 'Primary Key'
	if (isFk) return 'Foreign Key'

	const t = type.toLowerCase()
	if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('serial'))
		return 'Numeric'
	if (t.includes('char') || t.includes('text')) return 'Text'
	if (t.includes('date') || t.includes('time') || t.includes('year')) return 'Date/Time'
	if (t.includes('bool')) return 'Boolean'

	return 'Other'
}

export function SidebarBottomPanel({ table }: Props) {
	return (
		<div className='flex flex-col border-t border-sidebar-border bg-sidebar h-full min-h-0'>
			<div className='flex items-center justify-between px-3 py-2 border-b border-sidebar-border bg-sidebar/50'>
				<span className='text-xs font-medium text-sidebar-foreground'>STRUCTURE</span>
				<span className='text-xs text-muted-foreground'>
					{table.columns.length} columns
				</span>
			</div>

			<ScrollArea className='flex-1'>
				<div className='flex flex-col py-1'>
					{table.columns.map(function (col) {
						const Icon = getColumnIcon(
							col.data_type,
							col.is_primary_key,
							!!col.foreign_key
						)
						const tooltip = getColumnTooltip(
							col.data_type,
							col.is_primary_key,
							!!col.foreign_key
						)

						return (
							<div
								key={col.name}
								className='flex items-center gap-2 px-3 py-1.5 text-xs group hover:bg-sidebar-accent/50 transition-colors'
							>
								<Tooltip>
									<TooltipTrigger asChild>
										<Icon
											className={cn(
												'h-3 w-3 shrink-0 cursor-help',
												col.is_primary_key
													? 'text-amber-500'
													: col.foreign_key
														? 'text-blue-500'
														: 'text-muted-foreground'
											)}
										/>
									</TooltipTrigger>
									<TooltipContent side='right' className='text-xs'>
										{tooltip}
									</TooltipContent>
								</Tooltip>
								<span
									className={cn(
										'font-medium truncate flex-1',
										col.is_primary_key || col.foreign_key
											? 'text-sidebar-foreground'
											: 'text-muted-foreground group-hover:text-sidebar-foreground'
									)}
								>
									{col.name}
								</span>
								<span className='text-muted-foreground/60 font-mono text-[10px] shrink-0'>
									{col.data_type}
								</span>
							</div>
						)
					})}
				</div>
			</ScrollArea>

			<Popover>
				<PopoverTrigger asChild>
					<div className='flex h-10 items-center border-t border-sidebar-border px-3 bg-sidebar/50 cursor-pointer hover:bg-sidebar-accent/50 transition-colors'>
						<span className='text-xs font-medium text-muted-foreground'>INDEXES</span>
						<span className='ml-auto text-xs text-muted-foreground/60'>
							{table.indexes?.length || table.primary_key_columns?.length || 0}
						</span>
					</div>
				</PopoverTrigger>
				<PopoverContent side='top' align='start' className='w-80 p-0'>
					<div className='flex flex-col'>
						<div className='px-3 py-2 border-b border-border bg-muted/50'>
							<h4 className='font-medium text-xs text-muted-foreground'>
								Indexes ({table.indexes?.length || 0})
							</h4>
						</div>
						<div className='flex flex-col max-h-[300px] overflow-y-auto'>
							{table.indexes && table.indexes.length > 0 ? (
								table.indexes.map((idx) => (
									<div
										key={idx.name}
										className='flex flex-col gap-1 px-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/30'
									>
										<div className='flex items-center justify-between'>
											<span className='font-medium text-xs break-all'>{idx.name}</span>
											<div className='flex gap-1'>
												{idx.is_primary && (
													<Badge variant='outline' className='h-4 px-1 text-[9px] border-amber-500/50 text-amber-500'>
														PK
													</Badge>
												)}
												{idx.is_unique && !idx.is_primary && (
													<Badge variant='outline' className='h-4 px-1 text-[9px] border-blue-500/50 text-blue-500'>
														UQ
													</Badge>
												)}
											</div>
										</div>
										<div className='flex items-center gap-1.5 text-[10px] text-muted-foreground'>
											<Layers className='h-3 w-3 opacity-70' />
											<div className='flex flex-wrap gap-1'>
												{idx.column_names.map((col, i) => (
													<span key={i} className='bg-muted px-1 rounded'>
														{col}
													</span>
												))}
											</div>
										</div>
									</div>
								))
							) : (
								<div className='p-4 text-center text-xs text-muted-foreground'>
									No indexes found
								</div>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}

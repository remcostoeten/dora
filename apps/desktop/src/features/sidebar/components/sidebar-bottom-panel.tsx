import { Key, Link, Hash, Type, TextQuote, Lock, Calendar } from "lucide-react";
import { TableInfo } from "@/lib/bindings";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

type Props = {
	table: TableInfo
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
		<div className='flex flex-col border-t border-sidebar-border bg-sidebar shrink-0'>
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
									<TooltipContent side="right" className="text-xs">
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

			<div className='flex items-center border-t border-sidebar-border px-3 py-1.5 bg-sidebar/50 cursor-pointer hover:bg-sidebar-accent/50 transition-colors'>
				<span className='text-xs font-medium text-muted-foreground'>INDEXES</span>
				<span className='ml-auto text-xs text-muted-foreground/60'>
					{table.primary_key_columns?.length || 0}
				</span>
			</div>
		</div>
	)
}


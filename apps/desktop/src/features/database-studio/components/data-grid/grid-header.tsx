import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import React from 'react'
import { Checkbox } from '@/shared/ui/checkbox'
import { cn } from '@/shared/utils/cn'
import { ColumnDefinition, SortDescriptor } from '../../types'

type GridHeaderProps = {
	allSelected: boolean
	columns: ColumnDefinition[]
	getColumnWidth: (columnName: string) => number | undefined
	onResizeDoubleClick: (e: React.MouseEvent, columnName: string, columnType?: string) => void
	onResizeStart: (e: React.MouseEvent, columnName: string) => void
	onSelectAll: (checked: boolean) => void
	onSort: (columnName: string) => void
	resizingColumn: string | null
	someSelected: boolean
	sort?: SortDescriptor
}

export const GridHeader = React.memo(function GridHeader({
	allSelected,
	columns,
	getColumnWidth,
	onResizeDoubleClick,
	onResizeStart,
	onSelectAll,
	onSort,
	resizingColumn,
	someSelected,
	sort
}: GridHeaderProps) {
	return (
		<thead className='sticky top-0 bg-sidebar z-10' role='rowgroup'>
			<tr role='row'>
				<th
					className='px-4 py-2 text-center border-b border-r border-sidebar-border bg-background sticky left-0 z-30'
					role='columnheader'
					aria-label='Select all rows'
				>
					<Checkbox
						checked={someSelected ? 'indeterminate' : allSelected}
						onCheckedChange={function (checked) {
							onSelectAll(!!checked)
						}}
						className='h-4 w-4'
						aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
					/>
				</th>
				{columns.map(function (col) {
					const isSorted = sort?.column === col.name
					const width = getColumnWidth(col.name)

					return (
						<th
							key={col.name}
							className={cn(
								'text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 h-9 cursor-pointer transition-colors hover:bg-sidebar-accent relative select-none min-w-[60px]',
								isSorted && 'bg-sidebar-accent',
								resizingColumn === col.name && 'bg-sidebar-accent'
							)}
							style={width ? { width } : undefined}
							onClick={function () {
								onSort(col.name)
							}}
						>
							<div className='flex items-center gap-1.5 justify-between group px-3 py-2 overflow-hidden'>
								<div className='flex items-center gap-1.5 overflow-hidden min-w-0'>
									<span className='text-foreground text-xs shrink-0'>
										{col.name}
									</span>
									{col.type && col.type !== 'unknown' && (
										<span className='text-muted-foreground/50 text-[10px] font-normal font-mono lowercase truncate min-w-0'>
											{col.type}
										</span>
									)}
								</div>
								{isSorted && sort ? (
									sort.direction === 'asc' ? (
										<ArrowUp className='h-3 w-3 text-primary shrink-0' />
									) : (
										<ArrowDown className='h-3 w-3 text-primary shrink-0' />
									)
								) : (
									<ArrowUpDown className='h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0' />
								)}
							</div>

							<div
								className={cn(
									'absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors',
									resizingColumn === col.name && 'bg-primary'
								)}
								onMouseDown={function (e) {
									onResizeStart(e, col.name)
								}}
								onDoubleClick={function (e) {
									onResizeDoubleClick(e, col.name, col.type)
								}}
								onClick={function (e) {
									e.stopPropagation()
								}}
							/>
						</th>
					)
				})}
			</tr>
		</thead>
	)
})

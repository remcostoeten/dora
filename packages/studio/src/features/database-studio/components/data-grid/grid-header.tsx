import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import React, { useLayoutEffect, useRef, useState } from 'react'
import { Checkbox } from '@studio/shared/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { ColumnDefinition, SortDescriptor } from '../../types'

type ColumnHeaderLabelProps = {
	name: string
	type?: string
}

// Shows the full column name + type in a tooltip, but only when the header
// label is actually clipped — measuring scrollWidth against clientWidth so we
// don't add hover noise to columns that already fit.
function ColumnHeaderLabel({ name, type }: ColumnHeaderLabelProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isTruncated, setIsTruncated] = useState(false)

	useLayoutEffect(function measureOverflow() {
		const el = ref.current
		if (!el) return
		function update() {
			if (ref.current) {
				setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth)
			}
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(el)
		return function cleanup() {
			observer.disconnect()
		}
	}, [])

	const label = (
		<div ref={ref} className='flex items-center gap-1.5 overflow-hidden min-w-0'>
			<span className='text-foreground text-xs truncate min-w-0'>{name}</span>
			{type && type !== 'unknown' && (
				<span className='text-muted-foreground/50 text-[10px] font-normal font-mono lowercase truncate min-w-0 shrink-0'>
					{type}
				</span>
			)}
		</div>
	)

	if (!isTruncated) return label

	return (
		<Tooltip>
			<TooltipTrigger asChild>{label}</TooltipTrigger>
			<TooltipContent>
				{name}
				{type && type !== 'unknown' ? ` · ${type}` : ''}
			</TooltipContent>
		</Tooltip>
	)
}

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

export function GridHeader({
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
			<tr role='row' aria-rowindex={1}>
				<th
					className='w-[30px] min-w-[30px] p-0 text-center align-middle border-b border-l border-r border-sidebar-border bg-background sticky left-0 z-30'
					role='columnheader'
					aria-colindex={1}
					aria-label='Select all rows'
				>
					<Checkbox
						checked={someSelected ? 'indeterminate' : allSelected}
						onCheckedChange={function (checked) {
							onSelectAll(!!checked)
						}}
						className='h-4 w-4'
						aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
						// Not a tab stop — the grid is reached as one stop; toggle
						// via click or mod+A (select all).
						tabIndex={-1}
					/>
				</th>
				{columns.map(function (col, colIndex) {
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
							role='columnheader'
							aria-colindex={colIndex + 2}
							aria-sort={
								isSorted
									? sort?.direction === 'asc'
										? 'ascending'
										: 'descending'
									: 'none'
							}
							onClick={function () {
								onSort(col.name)
							}}
						>
							<div className='flex items-center gap-1.5 justify-between group px-3 py-2 overflow-hidden'>
								<ColumnHeaderLabel name={col.name} type={col.type} />
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
}

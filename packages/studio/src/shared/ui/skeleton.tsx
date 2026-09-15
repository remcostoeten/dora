import { cn } from '@studio/shared/utils/cn'

type Props = {
	className?: string
	rows?: number
	columns?: number
}

const ROW_STAGGER_MS = 60

function rowStagger(index: number): React.CSSProperties {
	return { '--skeleton-delay': `${index * ROW_STAGGER_MS}ms` } as React.CSSProperties
}

export function Skeleton({
	className,
	style
}: {
	className?: string
	style?: React.CSSProperties
}) {
	return <div className={cn('skeleton rounded-md', className)} style={style} />
}

export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
	return (
		<div className={cn('space-y-2', className)}>
			{Array.from({ length: rows }).map(function (_, i) {
				return (
					<div
						key={i}
						className='skeleton-row flex items-center gap-3 p-2'
						style={rowStagger(i)}
					>
						<Skeleton className='h-8 w-8 rounded' />
						<div className='flex-1 space-y-1'>
							<Skeleton className='h-4 w-3/4' />
							<Skeleton className='h-3 w-1/2' />
						</div>
					</div>
				)
			})}
		</div>
	)
}

export function SkeletonText({ className }: { className?: string }) {
	return <Skeleton className={cn('h-4 w-full', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
	return (
		<div className={cn('space-y-3 p-4', className)}>
			<Skeleton className='h-4 w-3/4' />
			<Skeleton className='h-4 w-1/2' />
			<Skeleton className='h-4 w-2/3' />
		</div>
	)
}

export function SkeletonTable({ rows = 5, columns = 4, className }: Props) {
	return (
		<div className={cn('space-y-2', className)}>
			<div className='flex gap-2'>
				{Array.from({ length: columns }).map(function (_, i) {
					return <Skeleton key={i} className='h-8 flex-1' />
				})}
			</div>
			{Array.from({ length: rows }).map(function (_, rowIndex) {
				return (
					<div
						key={rowIndex}
						className='skeleton-row flex gap-2'
						style={rowStagger(rowIndex)}
					>
						{Array.from({ length: columns }).map(function (_, colIndex) {
							return <Skeleton key={colIndex} className='h-10 flex-1' />
						})}
					</div>
				)
			})}
		</div>
	)
}

export type TableSkeletonColumn = {
	name?: string
	width?: number
}

// Mirrors the data grid's geometry: the 30px select column and the
// DEFAULT_COLUMN_WIDTH / MIN_COLUMN_WIDTH colgroup in
// features/database-studio/components/data-grid (use-column-resize.ts), which
// shared/ui cannot import from.
const GRID_SELECT_COLUMN_WIDTH = 30
const GRID_DEFAULT_COLUMN_WIDTH = 150
const GRID_MIN_COLUMN_WIDTH = 100

function headerBarWidth(name?: string): string {
	if (!name) return '5rem'
	return `${Math.min(Math.max(name.length, 3), 18)}ch`
}

function cellBarWidthClass(colIndex: number): string {
	if (colIndex === 0) return 'w-12'
	if (colIndex % 3 === 0) return 'w-24'
	if (colIndex % 2 === 0) return 'w-16'
	return 'w-32'
}

export function TableSkeleton({
	rows = 10,
	columns = 6
}: {
	rows?: number
	columns?: number | TableSkeletonColumn[]
}) {
	const resolvedColumns: TableSkeletonColumn[] = Array.isArray(columns)
		? columns
		: Array.from({ length: columns }).map(function () {
				return {}
			})

	return (
		<div className='h-full w-full overflow-hidden'>
			<table
				className='border-collapse text-sm'
				style={{ tableLayout: 'auto', minWidth: '100%' }}
				aria-hidden='true'
			>
				<colgroup>
					<col
						style={{
							width: GRID_SELECT_COLUMN_WIDTH,
							minWidth: GRID_SELECT_COLUMN_WIDTH
						}}
					/>
					{resolvedColumns.map(function (col, i) {
						return (
							<col
								key={col.name || i}
								style={{
									width: col.width || GRID_DEFAULT_COLUMN_WIDTH,
									minWidth: GRID_MIN_COLUMN_WIDTH
								}}
							/>
						)
					})}
				</colgroup>
				<thead>
					<tr>
						<th className='h-9 border-b border-r border-sidebar-border bg-sidebar-accent/50'>
							<div className='flex items-center justify-center'>
								<Skeleton className='h-4 w-4 rounded' />
							</div>
						</th>
						{resolvedColumns.map(function (col, i) {
							return (
								<th
									key={col.name || i}
									className='h-9 border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0'
								>
									<div className='px-3 py-2'>
										<Skeleton
											className='h-4'
											style={{
												width: headerBarWidth(col.name),
												maxWidth: '100%'
											}}
										/>
									</div>
								</th>
							)
						})}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rows }).map(function (_, rowIndex) {
						return (
							<tr
								key={rowIndex}
								className='skeleton-row'
								style={rowStagger(rowIndex)}
							>
								<td className='border-b border-r border-sidebar-border py-1.5'>
									<div className='flex items-center justify-center'>
										<Skeleton className='h-4 w-4 rounded' />
									</div>
								</td>
								{resolvedColumns.map(function (col, colIndex) {
									return (
										<td
											key={col.name || colIndex}
											className='border-b border-r border-sidebar-border px-3 py-1.5 last:border-r-0'
										>
											<Skeleton
												className={cn('h-4', cellBarWidthClass(colIndex))}
											/>
										</td>
									)
								})}
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

export function SidebarTableSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<div className='space-y-1 px-2 pt-2'>
			{Array.from({ length: rows }).map(function (_, i) {
				return (
					<div
						key={i}
						className='skeleton-row flex items-center gap-2 px-2 py-2 rounded-md'
						style={rowStagger(i)}
					>
						<Skeleton className='h-4 w-4 rounded' />
						<Skeleton
							className={cn(
								'h-4',
								i % 3 === 0 ? 'w-24' : i % 2 === 0 ? 'w-16' : 'w-28'
							)}
						/>
						<div className='ml-auto'>
							<Skeleton className='h-4 w-6 rounded' />
						</div>
					</div>
				)
			})}
		</div>
	)
}

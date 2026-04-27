import { cn } from '@/shared/utils/cn'

type Props = {
	className?: string
	rows?: number
	columns?: number
}

export function Skeleton({ className }: { className?: string }) {
	return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
	return (
		<div className={cn('space-y-2', className)}>
			{Array.from({ length: rows }).map(function (_, i) {
				return (
					<div key={i} className='flex items-center gap-3 p-2'>
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
					<div key={rowIndex} className='flex gap-2'>
						{Array.from({ length: columns }).map(function (_, colIndex) {
							return <Skeleton key={colIndex} className='h-10 flex-1' />
						})}
					</div>
				)
			})}
		</div>
	)
}

export function TableSkeleton({ rows = 10, columns = 6 }: { rows?: number; columns?: number }) {
	return (
		<div className='w-full'>
			{/* Header skeleton */}
			<div className='flex border-b border-sidebar-border bg-sidebar/30 px-4 py-3'>
				<div className='w-10 shrink-0' />
				{Array.from({ length: columns }).map(function (_, i) {
					return (
						<div key={`header-${i}`} className='flex-1 px-3'>
							<Skeleton className='h-4 w-20' />
						</div>
					)
				})}
				<div className='w-10 shrink-0' />
			</div>

			{/* Row skeletons */}
			{Array.from({ length: rows }).map(function (_, rowIndex) {
				return (
					<div
						key={`row-${rowIndex}`}
						className='flex border-b border-sidebar-border/50 px-4 py-3'
					>
						{/* Checkbox skeleton */}
						<div className='w-10 shrink-0 flex items-center'>
							<Skeleton className='h-4 w-4 rounded' />
						</div>

						{/* Cell skeletons */}
						{Array.from({ length: columns }).map(function (_, colIndex) {
							return (
								<div key={`cell-${rowIndex}-${colIndex}`} className='flex-1 px-3'>
									<Skeleton
										className={cn(
											'h-4',
											// Vary widths for more natural look
											colIndex === 0
												? 'w-12'
												: colIndex % 3 === 0
													? 'w-24'
													: colIndex % 2 === 0
														? 'w-16'
														: 'w-32'
										)}
									/>
								</div>
							)
						})}

						{/* Action skeleton */}
						<div className='w-10 shrink-0 flex items-center justify-center'>
							<Skeleton className='h-6 w-6 rounded' />
						</div>
					</div>
				)
			})}
		</div>
	)
}

export function SidebarTableSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<div className='space-y-1 px-2'>
			{Array.from({ length: rows }).map(function (_, i) {
				return (
					<div key={i} className='flex items-center gap-2 px-2 py-2 rounded-md'>
						<Skeleton className='h-4 w-4 rounded' />
						<Skeleton className={cn('h-4', i % 2 === 0 ? 'w-20' : 'w-28')} />
						<div className='ml-auto'>
							<Skeleton className='h-4 w-6 rounded' />
						</div>
					</div>
				)
			})}
		</div>
	)
}

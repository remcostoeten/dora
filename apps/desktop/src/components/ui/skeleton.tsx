import { cn } from "@/shared/utils/cn";

type SkeletonProps = {
	className?: string
}

export function Skeleton({ className }: SkeletonProps) {
	return <div className={cn('animate-pulse rounded-md bg-muted/50', className)} />
}

type TableSkeletonProps = {
	rows?: number
	columns?: number
}

export function TableSkeleton({ rows = 10, columns = 6 }: TableSkeletonProps) {
	return (
		<div className='w-full'>
			{/* Header skeleton */}
			<div className='flex border-b border-sidebar-border bg-sidebar/30 px-4 py-3'>
				<div className='w-10 shrink-0' />
				{Array.from({ length: columns }).map((_, i) => (
					<div key={`header-${i}`} className='flex-1 px-3'>
						<Skeleton className='h-4 w-20' />
					</div>
				))}
				<div className='w-10 shrink-0' />
			</div>

			{/* Row skeletons */}
			{Array.from({ length: rows }).map((_, rowIndex) => (
				<div
					key={`row-${rowIndex}`}
					className='flex border-b border-sidebar-border/50 px-4 py-3'
				>
					{/* Checkbox skeleton */}
					<div className='w-10 shrink-0 flex items-center'>
						<Skeleton className='h-4 w-4 rounded' />
					</div>

					{/* Cell skeletons */}
					{Array.from({ length: columns }).map((_, colIndex) => (
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
					))}

					{/* Action skeleton */}
					<div className='w-10 shrink-0 flex items-center justify-center'>
						<Skeleton className='h-6 w-6 rounded' />
					</div>
				</div>
			))}
		</div>
	)
}

export function SidebarTableSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<div className='space-y-1 px-2'>
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className='flex items-center gap-2 px-2 py-2 rounded-md'>
					<Skeleton className='h-4 w-4 rounded' />
					<Skeleton className={cn('h-4', i % 2 === 0 ? 'w-20' : 'w-28')} />
					<div className='ml-auto'>
						<Skeleton className='h-4 w-6 rounded' />
					</div>
				</div>
			))}
		</div>
	)
}

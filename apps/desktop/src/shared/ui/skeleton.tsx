import { cn } from '@/shared/utils/cn'

type Props = {
    className?: string
    rows?: number
    columns?: number
}

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-muted',
                className
            )}
        />
    )
}

export function SkeletonText({ className }: { className?: string }) {
    return <Skeleton className={cn('h-4 w-full', className)} />
}

export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn('space-y-3 p-4', className)}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
        </div>
    )
}

export function SkeletonTable({ rows = 5, columns = 4, className }: Props) {
    return (
        <div className={cn('space-y-2', className)}>
            <div className="flex gap-2">
                {Array.from({ length: columns }).map(function (_, i) {
                    return <Skeleton key={i} className="h-8 flex-1" />
                })}
            </div>
            {Array.from({ length: rows }).map(function (_, rowIndex) {
                return (
                    <div key={rowIndex} className="flex gap-2">
                        {Array.from({ length: columns }).map(function (_, colIndex) {
                            return <Skeleton key={colIndex} className="h-10 flex-1" />
                        })}
                    </div>
                )
            })}
        </div>
    )
}

export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: rows }).map(function (_, i) {
                return (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

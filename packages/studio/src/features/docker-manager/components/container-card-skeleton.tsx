import { Clock } from 'lucide-react'
import { Skeleton } from '@studio/shared/ui/skeleton'
import { Spinner } from '@studio/shared/ui/spinner'

export type PendingContainer = {
	name: string
	image: string
	imageTag: string
	hostPort: number
}

export function ContainerCardSkeleton() {
	return (
		<div className='p-3 rounded-lg border border-border/50'>
			<div className='flex items-start justify-between gap-2'>
				<div className='flex-1 min-w-0'>
					<Skeleton className='h-4 w-36' />
					<div className='mt-1.5 flex items-center gap-2'>
						<Skeleton className='h-3 w-24' />
						<Skeleton className='h-3 w-12' />
					</div>
				</div>
				<Skeleton className='h-5 w-16 rounded-full' />
			</div>
			<div className='mt-2.5 flex items-center gap-1'>
				<Skeleton className='h-3 w-3 rounded-full' />
				<Skeleton className='h-3 w-20' />
			</div>
		</div>
	)
}

export function PendingContainerCard({ container }: { container: PendingContainer }) {
	return (
		<div
			aria-busy='true'
			aria-label={`${container.name} (creating)`}
			className='p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 animate-pulse'
		>
			<div className='flex items-start justify-between gap-2'>
				<div className='flex-1 min-w-0'>
					<h3 className='font-medium text-sm truncate'>{container.name}</h3>
					<div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
						<span>
							{container.image}:{container.imageTag}
						</span>
						<span>•</span>
						<span>:{container.hostPort}</span>
					</div>
				</div>
				<span className='inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'>
					<Spinner className='h-3 w-3' />
					Creating
				</span>
			</div>
			<div className='mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/70'>
				<Clock className='h-3 w-3' />
				<span>just now</span>
			</div>
		</div>
	)
}

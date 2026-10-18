import { Skeleton } from '@studio/shared/ui/skeleton'

export function KvLoadingShell() {
	return (
		<div
			className='flex h-full flex-col bg-background text-foreground animate-in fade-in duration-300'
			aria-hidden='true'
		>
			<div className='flex h-11 shrink-0 items-center gap-3 border-b px-3'>
				<Skeleton className='h-4 w-28' />
				<Skeleton className='h-7 w-48' />
				<Skeleton className='h-7 w-32' />
			</div>
			<div className='grid min-h-0 flex-1 grid-cols-[minmax(15rem,21rem)_minmax(0,1fr)]'>
				<div className='space-y-2 border-r bg-muted/15 p-3'>
					<Skeleton className='h-8 w-full' />
					{Array.from({ length: 8 }).map(function (_, index) {
						return <Skeleton key={index} className='h-9 w-full' />
					})}
				</div>
				<div className='space-y-3 p-6'>
					<Skeleton className='h-6 w-56' />
					<Skeleton className='h-4 w-80' />
					<Skeleton className='h-40 w-full' />
				</div>
			</div>
		</div>
	)
}

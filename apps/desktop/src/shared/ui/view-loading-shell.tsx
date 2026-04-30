import type { ReactNode } from 'react'
import { Database, Network, PanelLeft, Search, SquareTerminal, Table2 } from 'lucide-react'
import { Skeleton, TableSkeleton } from '@/shared/ui/skeleton'
import { cn } from '@/shared/utils/cn'

type ViewId = 'database-studio' | 'sql-console' | 'schema-visualizer' | 'docker'

function LoadingFrame({
	children,
	className
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex h-full flex-col bg-background text-foreground animate-in fade-in duration-300',
				className
			)}
			aria-hidden='true'
		>
			{children}
		</div>
	)
}

function ToolbarChip({ width }: { width: string }) {
	return <Skeleton className={cn('h-7 rounded-full', width)} />
}

export function DatabaseStudioLoadingShell() {
	return (
		<LoadingFrame>
			<div className='border-b border-border bg-card/70 px-4 py-3'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='flex min-w-0 items-center gap-3'>
						<div className='flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80'>
							<Table2 className='h-4 w-4 text-muted-foreground' />
						</div>
						<div className='space-y-2'>
							<Skeleton className='h-3 w-24' />
							<Skeleton className='h-5 w-40' />
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Skeleton className='h-9 w-9 rounded-md' />
						<Skeleton className='h-9 w-24 rounded-md' />
						<Skeleton className='h-9 w-28 rounded-md' />
					</div>
				</div>
				<div className='mt-4 flex flex-wrap items-center gap-2'>
					<ToolbarChip width='w-24' />
					<ToolbarChip width='w-28' />
					<ToolbarChip width='w-20' />
					<ToolbarChip width='w-32' />
				</div>
			</div>

			<div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
				<div className='border-b border-border/80 bg-sidebar/20 px-4 py-2'>
					<div className='flex items-center gap-3'>
						<PanelLeft className='h-4 w-4 text-muted-foreground' />
						<Skeleton className='h-4 w-36' />
						<div className='ml-auto flex items-center gap-2'>
							<Skeleton className='h-4 w-16' />
							<Skeleton className='h-4 w-12' />
						</div>
					</div>
				</div>
				<div className='min-h-0 flex-1 overflow-hidden'>
					<TableSkeleton rows={12} columns={6} />
				</div>
				<div className='border-t border-border bg-card/60 px-4 py-2'>
					<div className='flex items-center gap-3'>
						<Skeleton className='h-3.5 w-24' />
						<Skeleton className='h-3.5 w-20' />
						<div className='ml-auto'>
							<Skeleton className='h-3.5 w-28' />
						</div>
					</div>
				</div>
			</div>
		</LoadingFrame>
	)
}

export function SqlConsoleLoadingShell() {
	return (
		<LoadingFrame>
			<div className='border-b border-border bg-card/70 px-4 py-3'>
				<div className='flex items-center justify-between gap-3'>
					<div className='flex items-center gap-3'>
						<div className='flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80'>
							<SquareTerminal className='h-4 w-4 text-muted-foreground' />
						</div>
						<div className='space-y-2'>
							<Skeleton className='h-3 w-28' />
							<Skeleton className='h-5 w-44' />
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Skeleton className='h-9 w-28 rounded-md' />
						<Skeleton className='h-9 w-24 rounded-md' />
						<Skeleton className='h-9 w-9 rounded-md' />
					</div>
				</div>
			</div>

			<div className='grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] overflow-hidden'>
				<div className='border-r border-border bg-sidebar/30 p-3'>
					<div className='space-y-3'>
						<div className='flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2'>
							<Search className='h-4 w-4 text-muted-foreground' />
							<Skeleton className='h-4 w-24' />
						</div>
						{Array.from({ length: 6 }).map(function (_, index) {
							return (
								<div key={index} className='rounded-lg border border-border/70 bg-card/60 p-3'>
									<Skeleton className='h-4 w-28' />
									<Skeleton className='mt-2 h-3 w-20' />
								</div>
							)
						})}
					</div>
				</div>

				<div className='grid min-h-0 grid-rows-[auto_minmax(0,1fr)_220px] overflow-hidden'>
					<div className='border-b border-border bg-card/50 px-4 py-2'>
						<div className='flex items-center gap-2'>
							{['w-32', 'w-28', 'w-36'].map(function (width) {
								return <Skeleton key={width} className={cn('h-8 rounded-md', width)} />
							})}
						</div>
					</div>
					<div className='bg-[#0e0e12] p-4'>
						<div className='h-full rounded-xl border border-border/60 bg-black/20 p-4'>
							<div className='space-y-3'>
								{['w-5/12', 'w-8/12', 'w-6/12', 'w-7/12', 'w-4/12'].map(function (width, index) {
									return <Skeleton key={index} className={cn('h-4 bg-white/10', width)} />
								})}
							</div>
						</div>
					</div>
					<div className='border-t border-border bg-card/60 p-3'>
						<TableSkeleton rows={4} columns={4} />
					</div>
				</div>
			</div>
		</LoadingFrame>
	)
}

export function SchemaVisualizerCanvasLoadingState() {
	return (
		<div className='relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_45%)]'>
			<div className='absolute inset-0 opacity-60'>
				<div className='absolute left-[8%] top-[14%] h-28 w-52 rounded-xl border border-border/80 bg-card/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]'>
					<Skeleton className='h-4 w-24' />
					<div className='mt-4 space-y-2'>
						<Skeleton className='h-3 w-10/12' />
						<Skeleton className='h-3 w-8/12' />
						<Skeleton className='h-3 w-9/12' />
					</div>
				</div>
				<div className='absolute left-[38%] top-[22%] h-32 w-56 rounded-xl border border-border/80 bg-card/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]'>
					<Skeleton className='h-4 w-28' />
					<div className='mt-4 space-y-2'>
						<Skeleton className='h-3 w-11/12' />
						<Skeleton className='h-3 w-7/12' />
						<Skeleton className='h-3 w-10/12' />
						<Skeleton className='h-3 w-8/12' />
					</div>
				</div>
				<div className='absolute left-[68%] top-[12%] h-28 w-48 rounded-xl border border-border/80 bg-card/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]'>
					<Skeleton className='h-4 w-20' />
					<div className='mt-4 space-y-2'>
						<Skeleton className='h-3 w-9/12' />
						<Skeleton className='h-3 w-10/12' />
						<Skeleton className='h-3 w-7/12' />
					</div>
				</div>
				<div className='absolute left-[24%] top-[31%] h-px w-[18%] bg-border/70' />
				<div className='absolute left-[56%] top-[28%] h-px w-[12%] bg-border/70' />
			</div>

			<div className='absolute bottom-4 left-4 rounded-xl border border-border/80 bg-card/85 px-3 py-2'>
				<div className='flex items-center gap-2'>
					<Database className='h-3.5 w-3.5 text-muted-foreground' />
					<Skeleton className='h-3.5 w-16' />
					<Skeleton className='h-3.5 w-12' />
				</div>
			</div>

			<div className='absolute bottom-4 right-4 rounded-xl border border-border/80 bg-card/85 p-3'>
				<div className='space-y-2'>
					<Skeleton className='h-3.5 w-24' />
					<Skeleton className='h-3.5 w-20' />
					<Skeleton className='h-3.5 w-28' />
				</div>
			</div>
		</div>
	)
}

export function SchemaVisualizerLoadingShell() {
	return (
		<LoadingFrame className='schema-visualizer'>
			<div className='border-b border-border bg-card/70 px-4 py-3'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='flex min-w-0 items-center gap-3'>
						<div className='flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80'>
							<Network className='h-4 w-4 text-muted-foreground' />
						</div>
						<div className='space-y-2'>
							<Skeleton className='h-3 w-24' />
							<Skeleton className='h-5 w-44' />
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Skeleton className='h-9 w-40 rounded-md' />
						<Skeleton className='h-9 w-24 rounded-md' />
						<Skeleton className='h-9 w-9 rounded-md' />
					</div>
				</div>
				<div className='mt-4 flex flex-wrap items-center gap-2'>
					<ToolbarChip width='w-24' />
					<ToolbarChip width='w-20' />
					<ToolbarChip width='w-20' />
					<ToolbarChip width='w-28' />
				</div>
			</div>

			<SchemaVisualizerCanvasLoadingState />
		</LoadingFrame>
	)
}

export function DockerLoadingShell() {
	return (
		<LoadingFrame>
			<div className='border-b border-border bg-card/70 px-4 py-3'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='space-y-2'>
						<Skeleton className='h-3 w-24' />
						<Skeleton className='h-5 w-40' />
					</div>
					<div className='flex items-center gap-2'>
						<Skeleton className='h-9 w-32 rounded-md' />
						<Skeleton className='h-9 w-24 rounded-md' />
					</div>
				</div>
				<div className='mt-4 flex flex-wrap items-center gap-2'>
					<Skeleton className='h-9 w-64 rounded-md' />
					<ToolbarChip width='w-20' />
					<ToolbarChip width='w-24' />
					<ToolbarChip width='w-24' />
				</div>
			</div>

			<div className='grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] overflow-hidden'>
				<div className='border-r border-border bg-sidebar/20 p-3'>
					<div className='space-y-3'>
						{Array.from({ length: 5 }).map(function (_, index) {
							return (
								<div key={index} className='rounded-xl border border-border/70 bg-card/60 p-4'>
									<div className='flex items-start gap-3'>
										<Skeleton className='h-10 w-10 rounded-md' />
										<div className='min-w-0 flex-1 space-y-2'>
											<Skeleton className='h-4 w-32' />
											<Skeleton className='h-3 w-24' />
											<div className='flex gap-2 pt-1'>
												<Skeleton className='h-6 w-16 rounded-full' />
												<Skeleton className='h-6 w-20 rounded-full' />
											</div>
										</div>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<div className='p-4'>
					<div className='h-full rounded-2xl border border-border bg-card/70 p-4'>
						<div className='flex items-center justify-between gap-3'>
							<div className='space-y-2'>
								<Skeleton className='h-5 w-40' />
								<Skeleton className='h-3 w-24' />
							</div>
							<div className='flex gap-2'>
								<Skeleton className='h-9 w-24 rounded-md' />
								<Skeleton className='h-9 w-28 rounded-md' />
							</div>
						</div>
						<div className='mt-6 grid gap-3 md:grid-cols-3'>
							{Array.from({ length: 3 }).map(function (_, index) {
								return (
									<div key={index} className='rounded-xl border border-border/70 bg-background/60 p-4'>
										<Skeleton className='h-3.5 w-20' />
										<Skeleton className='mt-3 h-6 w-16' />
									</div>
								)
							})}
						</div>
						<div className='mt-6 space-y-3'>
							<Skeleton className='h-4 w-28' />
							<Skeleton className='h-28 w-full rounded-xl' />
							<Skeleton className='h-28 w-full rounded-xl' />
						</div>
					</div>
				</div>
			</div>
		</LoadingFrame>
	)
}

export function ViewLoadingShell({ view }: { view: ViewId }) {
	if (view === 'sql-console') {
		return <SqlConsoleLoadingShell />
	}
	if (view === 'schema-visualizer') {
		return <SchemaVisualizerLoadingShell />
	}
	if (view === 'docker') {
		return <DockerLoadingShell />
	}
	return <DatabaseStudioLoadingShell />
}

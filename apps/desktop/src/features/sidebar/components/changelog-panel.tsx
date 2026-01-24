import { Sparkles, Wrench, RefreshCw, AlertTriangle } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/utils/cn'
import { CHANGELOG, CURRENT_VERSION, ChangelogEntry } from '../changelog-data'
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from './sidebar-panel'

type Props = {
	maxHeight?: number
}

function getTypeIcon(type: ChangelogEntry['type']) {
	switch (type) {
		case 'feature':
			return Sparkles
		case 'fix':
			return Wrench
		case 'refactor':
			return RefreshCw
		case 'breaking':
			return AlertTriangle
	}
}

function getTypeBadgeVariant(type: ChangelogEntry['type']) {
	switch (type) {
		case 'feature':
			return 'default'
		case 'fix':
			return 'secondary'
		case 'refactor':
			return 'outline'
		case 'breaking':
			return 'destructive'
	}
}

function formatDate(dateString: string): string {
	const date = new Date(dateString)
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

export function ChangelogPanel({ maxHeight = 500 }: Props) {
	return (
		<SidebarPanel>
			<SidebarPanelHeader title='Changelog' version={CURRENT_VERSION} />

			<SidebarPanelContent maxHeight={maxHeight}>
				<div className='p-2 space-y-1'>
					{CHANGELOG.map(function (entry, index) {
						const Icon = getTypeIcon(entry.type)
						const isLatest = index === 0

						return (
							<div
								key={entry.version}
								className={cn(
									'group p-3 rounded-md transition-colors',
									isLatest
										? 'bg-sidebar-accent/50 border border-sidebar-border'
										: 'hover:bg-sidebar-accent/30'
								)}
							>
								<div className='flex items-start gap-3'>
									<div
										className={cn(
											'mt-0.5 p-1.5 rounded-md',
											entry.type === 'breaking'
												? 'bg-destructive/10 text-destructive'
												: 'bg-primary/10 text-primary'
										)}
									>
										<Icon className='h-3.5 w-3.5' />
									</div>

									<div className='flex-1 min-w-0'>
										<div className='flex items-center gap-2 mb-1'>
											<span className='text-sm font-medium text-sidebar-foreground'>
												{entry.title}
											</span>
											{isLatest && (
												<Badge
													variant='default'
													className='text-[10px] px-1.5 py-0'
												>
													Latest
												</Badge>
											)}
										</div>

										<p className='text-xs text-muted-foreground leading-relaxed mb-2'>
											{entry.description}
										</p>

										<div className='flex items-center gap-2 text-[10px] text-muted-foreground'>
											<Badge
												variant={getTypeBadgeVariant(entry.type) as any}
												className='text-[10px] px-1.5 py-0'
											>
												v{entry.version}
											</Badge>
											<span className='opacity-50'>•</span>
											<span>{formatDate(entry.date)}</span>
											<span className='opacity-50'>•</span>
											<code className='font-mono bg-muted/50 px-1 rounded'>
												{entry.commit}
											</code>
										</div>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</SidebarPanelContent>
		</SidebarPanel>
	)
}

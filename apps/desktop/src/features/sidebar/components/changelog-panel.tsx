import { Sparkles, Wrench, RefreshCw, AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/utils/cn'
import { CHANGELOG, CURRENT_VERSION, ChangelogEntry } from '../changelog-data'
import { siteConfig } from '@/config/site'
import { SidebarPanel, SidebarPanelHeader, SidebarPanelContent } from './sidebar-panel'
import { useState } from 'react'

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
	const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

	const toggleVersion = (version: string) => {
		const newExpanded = new Set(expandedVersions)
		if (newExpanded.has(version)) {
			newExpanded.delete(version)
		} else {
			newExpanded.add(version)
		}
		setExpandedVersions(newExpanded)
	}

	return (
		<SidebarPanel>
			<SidebarPanelHeader title='Changelog' version={CURRENT_VERSION} />

			<SidebarPanelContent maxHeight={maxHeight}>
				<div className='p-2 space-y-1'>
					{CHANGELOG.map(function (entry, index) {
						const Icon = getTypeIcon(entry.type)
						const isLatest = index === 0
						const isExpanded = expandedVersions.has(entry.version)

						return (
							<div
								key={entry.version}
								className={cn(
									'group rounded-md transition-all duration-200 border border-transparent',
									isLatest
										? 'bg-sidebar-accent/50 border-sidebar-border'
										: 'hover:bg-sidebar-accent/30',
									isExpanded && 'bg-sidebar-accent/30 border-sidebar-border/50'
								)}
							>
								{/* Main Card Content - Clickable */}
								<div
									onClick={() => toggleVersion(entry.version)}
									className='p-3 cursor-pointer'
								>
									<div className='flex items-start gap-3'>
										<div
											className={cn(
												'mt-0.5 p-1.5 rounded-md transition-colors',
												entry.type === 'breaking'
													? 'bg-destructive/10 text-destructive'
													: 'bg-primary/10 text-primary'
											)}
										>
											<Icon className='h-3.5 w-3.5' />
										</div>

										<div className='flex-1 min-w-0'>
											<div className='flex items-center justify-between gap-2 mb-1'>
												<div className='flex items-center gap-2'>
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
												{entry.details && entry.details.length > 0 && (
													<ChevronRight
														className={cn(
															'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
															isExpanded && 'rotate-90'
														)}
													/>
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
												import {siteConfig} from '@/config/site'

												// ... imports

												// ... inside component

												<a
													href={`${siteConfig.links.github}/commit/${entry.commit}`}
													target='_blank'
													rel='noopener noreferrer'
													onClick={(e) => e.stopPropagation()}
													className='font-mono bg-muted/50 px-1.5 py-0.5 rounded hover:bg-muted hover:text-primary transition-colors inline-flex items-center gap-1 group/link'
												>
													{entry.commit}
													<ExternalLink className='h-2.5 w-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity' />
												</a>
											</div>
										</div>
									</div>
								</div>

								{/* Expanded Details */}
								{isExpanded && entry.details && (
									<div className='px-3 pb-3 pt-0 animate-in slide-in-from-top-1 duration-200'>
										<div className='ml-[2.875rem] pt-2 border-t border-sidebar-border/50'>
											<ul className='space-y-1.5'>
												{entry.details.map((detail, i) => (
													<li
														key={i}
														className='text-xs text-muted-foreground flex items-start gap-2'
													>
														<span className='w-1 h-1 rounded-full bg-border mt-1.5 shrink-0' />
														<span>{detail}</span>
													</li>
												))}
											</ul>
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</SidebarPanelContent>
		</SidebarPanel>
	)
}

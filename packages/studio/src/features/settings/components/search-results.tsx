import { CornerDownLeft, SearchX } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import type { SettingsSearchResult } from '../search'
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../sections'
import { Highlight, Kbd, SettingGroup } from './setting-primitives'

type Props = {
	query: string
	results: SettingsSearchResult[]
	activeIndex: number
	onOpen: (result: SettingsSearchResult) => void
	onHover: (index: number) => void
	onClear: () => void
}

export function SearchResults({ query, results, activeIndex, onOpen, onHover, onClear }: Props) {
	if (results.length === 0) {
		return (
			<div className='flex flex-col items-center gap-3 py-14 text-center'>
				<SearchX className='h-6 w-6 text-muted-foreground' />
				<div>
					<div className='text-sm font-semibold text-foreground'>
						No matching settings
					</div>
					<p className='mt-1 text-xs text-muted-foreground'>
						Nothing matches &ldquo;{query.trim()}&rdquo;. Try a shorter word.
					</p>
				</div>
				<button
					type='button'
					onClick={onClear}
					className='rounded-md px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-focus focus-visible:bg-focus-strong'
				>
					Clear search
				</button>
			</div>
		)
	}

	const order: SettingsSectionId[] = []
	for (const result of results) {
		if (!order.includes(result.sectionId)) order.push(result.sectionId)
	}

	return (
		<>
			{order.map((sectionId) => {
				const section = SETTINGS_SECTIONS[sectionId]
				const Icon = section.icon
				return (
					<SettingGroup
						key={sectionId}
						label={section.title}
						action={<Icon className='h-3.5 w-3.5 text-muted-foreground' />}
					>
						<div className='overflow-hidden rounded-lg border border-border bg-foreground/[0.015]'>
							{results
								.map((result, index) => ({ result, index }))
								.filter(({ result }) => result.sectionId === sectionId)
								.map(({ result, index }) => (
									<button
										key={result.id}
										type='button'
										onClick={() => onOpen(result)}
										onMouseEnter={() => onHover(index)}
										className={cn(
											'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border px-3.5 py-2.5 text-left transition-colors duration-100 first:border-t-0 focus-visible:bg-focus-strong',
											index === activeIndex
												? 'bg-focus-strong'
												: 'hover:bg-focus'
										)}
									>
										<span className='min-w-0'>
											<span className='block text-[13px] font-medium text-foreground'>
												<Highlight text={result.title} query={query} />
											</span>
											<span className='block truncate text-xs text-muted-foreground'>
												<Highlight
													text={result.description}
													query={query}
												/>
											</span>
										</span>
										<span
											className={cn(
												'flex items-center gap-1.5 text-[11.5px] text-muted-foreground',
												index !== activeIndex && 'invisible'
											)}
										>
											{result.kind === 'section'
												? 'Open section'
												: 'Go to setting'}
											<Kbd>
												<CornerDownLeft className='h-2.5 w-2.5' />
											</Kbd>
										</span>
									</button>
								))}
						</div>
					</SettingGroup>
				)
			})}
		</>
	)
}

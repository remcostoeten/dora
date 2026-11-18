import { Search, X } from 'lucide-react'
import type { KeyboardEvent, RefObject } from 'react'
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsSectionId } from '../sections'
import { UpdateDot } from '@studio/features/updater/update-dot'
import { useUpdateIndicatorMode } from '@studio/features/updater/use-update-indicator'
import { Kbd } from './setting-primitives'

type Props = {
	query: string
	onQueryChange: (query: string) => void
	onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
	searchRef: RefObject<HTMLInputElement>
	activeSection: SettingsSectionId
	sections: readonly SettingsSectionId[]
	matchCounts: ReadonlyMap<SettingsSectionId, number> | null
	total: number
	onSelect: (section: SettingsSectionId) => void
}

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
	if (
		event.key !== 'ArrowDown' &&
		event.key !== 'ArrowUp' &&
		event.key !== 'Home' &&
		event.key !== 'End'
	) {
		return
	}
	const items = Array.from(
		event.currentTarget.querySelectorAll<HTMLElement>('[data-nav-item]:not([disabled])')
	)
	const index = items.indexOf(document.activeElement as HTMLElement)
	if (index < 0) return
	event.preventDefault()
	const next =
		event.key === 'ArrowDown'
			? index + 1
			: event.key === 'ArrowUp'
				? index - 1
				: event.key === 'Home'
					? 0
					: items.length - 1
	items[Math.max(0, Math.min(items.length - 1, next))].focus()
}

export function SettingsNav({
	query,
	onQueryChange,
	onSearchKeyDown,
	searchRef,
	activeSection,
	sections,
	matchCounts,
	total,
	onSelect
}: Props) {
	const updateMode = useUpdateIndicatorMode()
	const searching = matchCounts !== null
	const visible = new Set(sections)
	const groups = SETTINGS_GROUPS.map((group) => ({
		label: group.label,
		items: group.items.filter((id) => visible.has(id))
	})).filter((group) => group.items.length > 0)

	return (
		<aside className='settings-nav'>
			<div className='px-3.5 pb-2.5 pt-3.5'>
				<h1 className='text-sm font-semibold tracking-tight text-foreground'>Settings</h1>
				<div className='mt-0.5 font-mono text-[11px] text-muted-foreground'>
					{sections.length} sections
				</div>
			</div>

			<label className='settings-search'>
				<Search className='h-[13px] w-[13px] shrink-0' />
				<input
					ref={searchRef}
					type='search'
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					onKeyDown={onSearchKeyDown}
					placeholder='Search settings'
					aria-label='Search settings'
					autoComplete='off'
					spellCheck={false}
				/>
				{searching ? (
					<>
						<span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
							{total}
						</span>
						<button
							type='button'
							aria-label='Clear search'
							onClick={() => {
								onQueryChange('')
								searchRef.current?.focus()
							}}
							className='settings-icon-button h-5 w-5'
						>
							<X className='h-3 w-3' />
						</button>
					</>
				) : (
					<Kbd>/</Kbd>
				)}
			</label>

			<nav aria-label='Settings sections' onKeyDown={moveFocus} className='settings-nav-list'>
				{groups.map((group) => (
					<div key={group.label} className='mt-2.5 first:mt-1'>
						<div className='settings-eyebrow px-2 pb-1.5'>{group.label}</div>
						{group.items.map((id) => {
							const section = SETTINGS_SECTIONS[id]
							const Icon = section.icon
							const count = matchCounts?.get(id)
							const disabled = searching && count === undefined
							const current = !disabled && id === activeSection
							return (
								<button
									key={id}
									type='button'
									data-nav-item
									disabled={disabled}
									aria-current={current ? 'true' : undefined}
									tabIndex={id === activeSection ? 0 : -1}
									onClick={() => onSelect(id)}
									className='settings-nav-item'
								>
									<Icon className='h-[14px] w-[14px] shrink-0' />
									<span className='min-w-0 flex-1 truncate'>{section.title}</span>
									{id === 'updates' &&
									(updateMode === 'available' ||
										updateMode === 'snoozed' ||
										updateMode === 'error') ? (
										<UpdateDot
											variant={
												updateMode === 'available'
													? 'new'
													: updateMode === 'snoozed'
														? 'snoozed'
														: 'error'
											}
										/>
									) : null}
									{count ? (
										<span className='font-mono text-[10.5px] tabular-nums text-muted-foreground'>
											{count}
										</span>
									) : null}
								</button>
							)
						})}
					</div>
				))}
			</nav>

			<div className='flex items-center gap-3 border-t border-border/70 px-3.5 py-2.5 text-[11px] text-muted-foreground'>
				<span className='inline-flex items-center gap-1.5'>
					<Kbd>/</Kbd>Search
				</span>
				<span className='inline-flex items-center gap-1.5'>
					<Kbd>esc</Kbd>Clear
				</span>
				<span className='inline-flex items-center gap-1.5'>
					<Kbd>↵</Kbd>Jump
				</span>
			</div>
		</aside>
	)
}

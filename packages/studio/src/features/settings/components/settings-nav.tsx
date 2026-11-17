import { Search, Settings as SettingsIcon, X } from 'lucide-react'
import type { KeyboardEvent, RefObject } from 'react'
import { cn } from '@studio/shared/utils/cn'
import { SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsSectionId } from '../sections'
import { Kbd } from './setting-primitives'

type Props = {
	query: string
	onQueryChange: (query: string) => void
	onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
	searchRef: RefObject<HTMLInputElement>
	activeSection: SettingsSectionId
	visibleSections: ReadonlySet<SettingsSectionId>
	matchCounts: ReadonlyMap<SettingsSectionId, number>
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
	const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-nav-item]'))
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
	visibleSections,
	matchCounts,
	onSelect
}: Props) {
	const searching = query.trim().length > 0
	const tabbable = visibleSections.has(activeSection)
		? activeSection
		: SETTINGS_GROUPS.flatMap((group) => group.items).find((id) => visibleSections.has(id))
	const groups = SETTINGS_GROUPS.map((group) => ({
		label: group.label,
		items: group.items.filter((id) => visibleSections.has(id))
	})).filter((group) => group.items.length > 0)

	return (
		<aside className='flex min-h-0 w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar'>
			<div className='px-3 pb-2.5 pt-4'>
				<div className='flex items-center gap-2 px-1 pb-3 text-[13px] font-semibold text-foreground'>
					<SettingsIcon className='h-[15px] w-[15px]' />
					Settings
				</div>
				<div className='relative'>
					<Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
					<input
						ref={searchRef}
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						onKeyDown={onSearchKeyDown}
						placeholder='Search settings'
						aria-label='Search settings'
						autoComplete='off'
						spellCheck={false}
						className='peer h-[30px] w-full rounded-md border border-input bg-foreground/[0.03] pl-[29px] pr-8 text-xs text-sidebar-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground hover:bg-focus focus:bg-focus'
					/>
					{searching ? (
						<button
							type='button'
							aria-label='Clear search'
							onClick={() => {
								onQueryChange('')
								searchRef.current?.focus()
							}}
							className='absolute right-1 top-1/2 grid h-[22px] w-[22px] -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong focus-visible:text-foreground'
						>
							<X className='h-3.5 w-3.5' />
						</button>
					) : (
						<span className='pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 peer-focus:hidden'>
							<Kbd>/</Kbd>
						</span>
					)}
				</div>
			</div>

			<nav
				aria-label='Settings sections'
				onKeyDown={moveFocus}
				className='min-h-0 flex-1 overflow-y-auto px-2 pb-3'
			>
				{groups.map((group) => (
					<div key={group.label} className='[&+&]:mt-2.5'>
						<div className='px-2 pb-1 pt-2 text-[11.5px] font-semibold text-muted-foreground'>
							{group.label}
						</div>
						{group.items.map((id) => {
							const section = SETTINGS_SECTIONS[id]
							const Icon = section.icon
							const current = !searching && id === activeSection
							const count = matchCounts.get(id)
							return (
								<button
									key={id}
									type='button'
									data-nav-item
									aria-current={current ? 'page' : undefined}
									tabIndex={id === tabbable ? 0 : -1}
									onClick={() => onSelect(id)}
									className={cn(
										'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-150',
										current
											? 'bg-accent font-medium text-foreground focus-visible:bg-focus-strong'
											: 'text-sidebar-foreground hover:bg-focus focus-visible:bg-focus-strong'
									)}
								>
									<Icon
										className={cn(
											'h-[15px] w-[15px] shrink-0 transition-colors duration-150',
											current ? 'text-foreground' : 'text-muted-foreground'
										)}
									/>
									<span className='min-w-0 flex-1 truncate'>{section.title}</span>
									{searching && count ? (
										<span className='grid h-[18px] min-w-5 place-items-center rounded bg-foreground/[0.08] px-1.5 text-[11.5px] font-normal tabular-nums text-foreground'>
											{count}
										</span>
									) : null}
								</button>
							)
						})}
					</div>
				))}
				{groups.length === 0 ? (
					<p className='px-2.5 py-4 text-xs text-muted-foreground'>No sections match.</p>
				) : null}
			</nav>

			<div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-sidebar-border px-3.5 py-2.5 text-[11px] text-muted-foreground'>
				<span className='inline-flex items-center gap-1.5'>
					<Kbd>/</Kbd>Search
				</span>
				<span className='inline-flex items-center gap-1.5'>
					<Kbd>↑↓</Kbd>Sections
				</span>
			</div>
		</aside>
	)
}

import { AgentAccessScreen } from '@studio/features/agent-access'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
	type RefObject
} from 'react'
import { SearchX } from 'lucide-react'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts } from '@studio/core/shortcuts'
import { useAiSelection } from '@studio/features/ai-assistant/ai-selection-store'
import { Highlight, SettingsFilterProvider } from './components/setting-primitives'
import { SettingsNav } from './components/settings-nav'
import { buildSearchFilter, searchSettings } from './search'
import {
	AI_SECTION_IDS,
	SETTINGS_GROUPS,
	SETTINGS_SECTIONS,
	groupLabelOf,
	type SettingsSectionId
} from './sections'
import { AiProviderScreen } from './screens/ai-provider-screen'
import { AppearanceScreen } from './screens/appearance-screen'
import { EditorScreen } from './screens/editor-screen'
import {
	AiKeysScreen,
	AiUsageScreen,
	BuildCacheScreen,
	OllamaModelsScreen,
	StorageScreen,
	UpdatesScreen
} from './screens/embedded-screens'
import { InterfaceScreen, SafetyScreen, StartupScreen } from './screens/preference-screens'
import { ShortcutsScreen } from './screens/shortcuts-screen'
import './settings.css'

type Props = {
	windowControls?: ReactNode
	initialSection?: SettingsSectionId
	highlightSection?: SettingsSectionId
}

type ScrollRequest = {
	id: SettingsSectionId
	highlight: boolean
}

const FOCUSABLE =
	'button:not([disabled]), input:not([disabled]), [role="slider"], [role="switch"], [role="radio"][aria-checked="true"]'

const ALL_SECTION_IDS = SETTINGS_GROUPS.flatMap((group) => group.items)

const DEFERRED_SECTIONS: ReadonlySet<SettingsSectionId> = new Set(['updates', 'build-cache'])

const SPY_OFFSET = 32

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.isContentEditable ||
		target.closest('input, textarea, select, [role="textbox"], .monaco-editor') !== null
	)
}

function flash(node: HTMLElement, className: string, duration: number) {
	node.classList.remove(className)
	void node.offsetWidth
	node.classList.add(className)
	window.setTimeout(() => node.classList.remove(className), duration)
}

function sectionNode(body: HTMLElement | null, id: SettingsSectionId) {
	return body?.querySelector<HTMLElement>(`[data-settings-section="${id}"]`) ?? null
}

function DeferredMount({
	force,
	rootRef,
	children
}: {
	force: boolean
	rootRef: RefObject<HTMLDivElement>
	children: ReactNode
}) {
	const [seen, setSeen] = useState(false)
	const placeholderRef = useRef<HTMLDivElement>(null)
	const shown = force || seen

	useEffect(() => {
		if (shown) return
		const node = placeholderRef.current
		if (!node) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) setSeen(true)
			},
			{ root: rootRef.current, rootMargin: '240px 0px' }
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [shown, rootRef])

	if (shown) return <>{children}</>
	return <div ref={placeholderRef} className='settings-card h-24' />
}

export function SettingsView({ windowControls, initialSection, highlightSection }: Props = {}) {
	const { settings } = useSettings()
	const shortcuts = useEffectiveShortcuts()
	const aiSelection = useAiSelection()
	const [activeSection, setActiveSection] = useState<SettingsSectionId>(
		initialSection ?? 'editor'
	)
	const [query, setQuery] = useState('')
	const [forcedUpTo, setForcedUpTo] = useState(-1)
	const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(
		initialSection ? { id: initialSection, highlight: false } : null
	)
	const searchRef = useRef<HTMLInputElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const quietUntil = useRef(0)

	const searching = query.trim().length > 0
	const showLocalModels =
		aiSelection.provider === 'ollama' ||
		initialSection === 'ollama-models' ||
		highlightSection === 'ollama-models'

	const sections = useMemo(
		() =>
			ALL_SECTION_IDS.filter((id) => {
				if (settings.hideAi && AI_SECTION_IDS.has(id)) return false
				if (id === 'ollama-models') return showLocalModels
				return true
			}),
		[settings.hideAi, showLocalModels]
	)

	const filter = useMemo(() => {
		if (!searching) return null
		const visible = new Set(sections)
		const results = searchSettings(query, shortcuts).filter((result) =>
			visible.has(result.sectionId)
		)
		return buildSearchFilter(results)
	}, [searching, query, shortcuts, sections])

	const matchCounts = useMemo(() => {
		if (!filter) return null
		const counts = new Map<SettingsSectionId, number>()
		for (const id of filter.sections) counts.set(id, filter.rows.get(id)?.size ?? 0)
		return counts
	}, [filter])

	const rendered = filter ? sections.filter((id) => filter.sections.has(id)) : sections

	const scrollToSection = useCallback((id: SettingsSectionId) => {
		const body = bodyRef.current
		const node = sectionNode(body, id)
		if (!body || !node) return null
		quietUntil.current = performance.now() + 120
		const offset = node.getBoundingClientRect().top - body.getBoundingClientRect().top
		body.scrollTo({ top: body.scrollTop + offset })
		return node
	}, [])

	const updateActive = useCallback(() => {
		if (performance.now() < quietUntil.current) return
		const body = bodyRef.current
		if (!body) return
		const nodes = Array.from(body.querySelectorAll<HTMLElement>('[data-settings-section]'))
		if (nodes.length === 0) return
		const threshold = body.getBoundingClientRect().top + SPY_OFFSET
		let current = nodes[0]
		for (const node of nodes) {
			if (node.getBoundingClientRect().top <= threshold) current = node
		}
		if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) {
			current = nodes[nodes.length - 1]
		}
		const id = current.dataset.settingsSection as SettingsSectionId | undefined
		if (id) setActiveSection(id)
	}, [])

	useEffect(() => {
		const body = bodyRef.current
		if (!body) return
		let frame = 0
		function onScroll() {
			window.cancelAnimationFrame(frame)
			frame = window.requestAnimationFrame(updateActive)
		}
		body.addEventListener('scroll', onScroll, { passive: true })
		return () => {
			body.removeEventListener('scroll', onScroll)
			window.cancelAnimationFrame(frame)
		}
	}, [updateActive])

	useEffect(() => {
		if (!scrollRequest) return
		const frame = window.requestAnimationFrame(() => {
			const node = scrollToSection(scrollRequest.id)
			if (node && scrollRequest.highlight) flash(node, 'settings-section-highlight', 2400)
		})
		return () => window.cancelAnimationFrame(frame)
	}, [scrollRequest, scrollToSection])

	const requestSection = useCallback((id: SettingsSectionId, highlight: boolean) => {
		setForcedUpTo((current) => Math.max(current, ALL_SECTION_IDS.indexOf(id)))
		setActiveSection(id)
		setScrollRequest({ id, highlight })
	}, [])

	useEffect(() => {
		if (initialSection) requestSection(initialSection, false)
	}, [initialSection, requestSection])

	useEffect(() => {
		if (highlightSection) requestSection(highlightSection, true)
	}, [highlightSection, requestSection])

	useEffect(() => {
		if (!searching) return
		bodyRef.current?.scrollTo({ top: 0 })
		const frame = window.requestAnimationFrame(updateActive)
		return () => window.cancelAnimationFrame(frame)
	}, [query, searching, updateActive])

	useEffect(() => {
		if (!sections.includes(activeSection)) setActiveSection(sections[0] ?? 'editor')
	}, [activeSection, sections])

	useEffect(() => {
		function handleKeyDown(event: globalThis.KeyboardEvent) {
			const recording = document.querySelector('[data-shortcut-recording="true"]') !== null
			const find = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'
			const slash =
				!event.metaKey && !event.ctrlKey && !event.altKey && event.key === '/' && !recording
			if (!find && !slash) return
			if (slash && isTypingTarget(event.target)) return
			const input = searchRef.current
			if (!input || input.closest('[hidden], [inert], [aria-hidden="true"]')) return
			event.preventDefault()
			input.focus()
			input.select()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	const goToSection = useCallback(
		(id: SettingsSectionId) => {
			if (!searching) {
				requestSection(id, false)
				return
			}
			setActiveSection(id)
			scrollToSection(id)
		},
		[requestSection, scrollToSection, searching]
	)

	function jumpToFirstMatch() {
		const row = bodyRef.current?.querySelector<HTMLElement>('[data-settings-focus]')
		if (!row) return
		row.scrollIntoView({ block: 'center' })
		flash(row, 'settings-row-flash', 1700)
		const control = row.querySelector<HTMLElement>(FOCUSABLE)
		;(control ?? row).focus({ preventScroll: true })
	}

	function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			if (!query) return
			event.preventDefault()
			setQuery('')
			return
		}
		if (event.key === 'Enter' || event.key === 'ArrowDown') {
			event.preventDefault()
			jumpToFirstMatch()
		}
	}

	function renderScreen(id: SettingsSectionId) {
		switch (id) {
			case 'editor':
				return <EditorScreen />
			case 'appearance':
				return <AppearanceScreen />
			case 'shortcuts':
				return <ShortcutsScreen />
			case 'interface':
				return <InterfaceScreen />
			case 'ai-provider':
				return <AiProviderScreen onNavigate={goToSection} />
			case 'ollama-models':
				return <OllamaModelsScreen />
			case 'ai-keys':
				return <AiKeysScreen />
			case 'ai-usage':
				return <AiUsageScreen />
			case 'startup':
				return <StartupScreen />
			case 'safety':
				return <SafetyScreen />
			case 'agent-access':
				return <AgentAccessScreen />
			case 'storage':
				return <StorageScreen />
			case 'updates':
				return <UpdatesScreen />
			case 'build-cache':
				return <BuildCacheScreen />
		}
	}

	function renderSection(id: SettingsSectionId) {
		const section = SETTINGS_SECTIONS[id]
		const rows = filter ? (filter.rows.get(id) ?? null) : null
		const screen = renderScreen(id)
		const number = String(sections.indexOf(id) + 1).padStart(2, '0')
		return (
			<section key={id} data-settings-section={id} className='settings-section'>
				<header className='flex items-end gap-3 pb-3.5'>
					<div className='min-w-0 flex-1'>
						<span className='settings-eyebrow mb-1.5 block'>{groupLabelOf(id)}</span>
						<h3 className='text-sm font-semibold tracking-tight text-foreground'>
							<Highlight text={section.title} query={query} />
						</h3>
						<p className='mt-0.5 text-xs text-muted-foreground'>
							{section.description}
						</p>
					</div>
					<span className='pb-[3px] font-mono text-[11px] text-muted-foreground/60'>
						{number}
					</span>
				</header>
				<SettingsFilterProvider value={{ query, rows }}>
					{DEFERRED_SECTIONS.has(id) ? (
						<DeferredMount
							force={forcedUpTo >= ALL_SECTION_IDS.indexOf(id)}
							rootRef={bodyRef}
						>
							{screen}
						</DeferredMount>
					) : (
						screen
					)}
				</SettingsFilterProvider>
			</section>
		)
	}

	const crumbSection = SETTINGS_SECTIONS[activeSection]

	return (
		<div className='settings-view flex h-full min-h-0 overflow-hidden bg-background'>
			<SettingsNav
				query={query}
				onQueryChange={setQuery}
				onSearchKeyDown={handleSearchKeyDown}
				searchRef={searchRef}
				activeSection={activeSection}
				sections={sections}
				matchCounts={matchCounts}
				total={filter?.total ?? 0}
				onSelect={goToSection}
			/>

			<main className='flex min-h-0 min-w-0 flex-1 flex-col'>
				<header className='settings-topbar' data-tauri-drag-region='true'>
					<div className='flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground'>
						<span>Settings</span>
						<span className='text-muted-foreground/50'>/</span>
						{searching ? (
							<span className='font-medium text-foreground'>Search</span>
						) : (
							<>
								<span>{groupLabelOf(activeSection)}</span>
								<span className='text-muted-foreground/50'>/</span>
								<span className='font-medium text-foreground'>
									{crumbSection.title}
								</span>
							</>
						)}
					</div>
					{windowControls ? (
						<div className='ml-auto shrink-0' data-tauri-drag-region='false'>
							{windowControls}
						</div>
					) : null}
				</header>

				<div
					ref={bodyRef}
					data-settings-searching={searching ? 'true' : undefined}
					className='settings-body @container min-h-0 flex-1 overflow-y-auto'
				>
					<div className='w-full max-w-[860px] px-8 pb-28 pt-5'>
						{searching ? (
							<p className='text-xs text-muted-foreground'>
								{filter && filter.total > 0
									? `${filter.total} ${filter.total === 1 ? 'match' : 'matches'} for “${query.trim()}”`
									: null}
							</p>
						) : (
							<div>
								<h2 className='text-[15px] font-semibold tracking-tight text-foreground'>
									Application settings
								</h2>
								<p className='mt-0.5 text-xs text-muted-foreground'>
									Editor behavior, appearance, shortcuts, AI, storage and updates.
								</p>
							</div>
						)}

						{rendered.length === 0 ? (
							<div className='flex flex-col items-center py-16 text-center'>
								<span className='grid h-9 w-9 place-items-center rounded-lg bg-secondary text-muted-foreground'>
									<SearchX className='h-4 w-4' />
								</span>
								<h4 className='mt-3 text-[13px] font-semibold text-foreground'>
									No settings match “{query.trim()}”
								</h4>
								<p className='mt-1 text-xs text-muted-foreground'>
									Try a broader term like “theme”, “key” or “cache”.
								</p>
								<button
									type='button'
									onClick={() => {
										setQuery('')
										searchRef.current?.focus()
									}}
									className='settings-button mt-3.5'
								>
									Clear search
								</button>
							</div>
						) : (
							rendered.map(renderSection)
						)}
					</div>
				</div>
			</main>
		</div>
	)
}

export const SettingsPanel = SettingsView

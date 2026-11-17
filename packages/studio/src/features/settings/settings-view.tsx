import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode
} from 'react'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts } from '@studio/core/shortcuts'
import { useAiSelection } from '@studio/features/ai-assistant/ai-selection-store'
import { SearchResults } from './components/search-results'
import { SettingsNav } from './components/settings-nav'
import { searchSettings, type SettingsSearchResult } from './search'
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

type Props = {
	windowControls?: ReactNode
	initialSection?: SettingsSectionId
	highlightSection?: SettingsSectionId
}

const FOCUSABLE =
	'button:not([disabled]), input:not([disabled]), [role="slider"], [role="switch"], [role="radio"][aria-checked="true"]'

const ALL_SECTION_IDS = SETTINGS_GROUPS.flatMap((group) => group.items)

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.isContentEditable ||
		target.closest('input, textarea, select, [role="textbox"], .monaco-editor') !== null
	)
}

function flashRow(row: HTMLElement) {
	row.classList.remove('settings-row-flash')
	void row.offsetWidth
	row.classList.add('settings-row-flash')
	window.setTimeout(() => row.classList.remove('settings-row-flash'), 1700)
}

export function SettingsView({ windowControls, initialSection, highlightSection }: Props = {}) {
	const { settings } = useSettings()
	const shortcuts = useEffectiveShortcuts()
	const aiSelection = useAiSelection()
	const [activeSection, setActiveSection] = useState<SettingsSectionId>(
		initialSection ?? 'editor'
	)
	const [query, setQuery] = useState('')
	const [activeResult, setActiveResult] = useState(0)
	const [shortcutQuery, setShortcutQuery] = useState('')
	const searchRef = useRef<HTMLInputElement>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const screenRef = useRef<HTMLDivElement>(null)
	const pendingFocus = useRef<string | null>(null)

	const searching = query.trim().length > 0
	const hideAi = settings.hideAi
	const showLocalModels = aiSelection.provider === 'ollama' || activeSection === 'ollama-models'

	const visibleSections = useMemo(() => {
		const visible = ALL_SECTION_IDS.filter((id) => {
			if (hideAi && AI_SECTION_IDS.has(id)) return false
			if (id === 'ollama-models') return showLocalModels
			return true
		})
		return new Set(visible)
	}, [hideAi, showLocalModels])

	const results = useMemo(
		() =>
			searchSettings(query, shortcuts).filter((result) =>
				visibleSections.has(result.sectionId)
			),
		[query, shortcuts, visibleSections]
	)

	const matchCounts = useMemo(() => {
		const counts = new Map<SettingsSectionId, number>()
		for (const result of results) {
			counts.set(result.sectionId, (counts.get(result.sectionId) ?? 0) + 1)
		}
		return counts
	}, [results])

	const navSections = useMemo(
		() => (searching ? new Set(matchCounts.keys()) : visibleSections),
		[searching, matchCounts, visibleSections]
	)

	const section = SETTINGS_SECTIONS[activeSection]

	useEffect(() => {
		setActiveResult(0)
	}, [query])

	useEffect(() => {
		if (!visibleSections.has(activeSection)) setActiveSection('editor')
	}, [activeSection, visibleSections])

	useEffect(() => {
		if (initialSection) setActiveSection(initialSection)
	}, [initialSection])

	useEffect(() => {
		if (!highlightSection) return
		setActiveSection(highlightSection)
		let removeTimer = 0
		const frame = window.requestAnimationFrame(() => {
			const node = screenRef.current
			if (!node) return
			node.classList.add('settings-section-highlight')
			removeTimer = window.setTimeout(
				() => node.classList.remove('settings-section-highlight'),
				2400
			)
		})
		return () => {
			window.cancelAnimationFrame(frame)
			window.clearTimeout(removeTimer)
		}
	}, [highlightSection])

	useEffect(() => {
		const targetId = pendingFocus.current
		if (!targetId || searching) return
		let attempts = 0
		let frame = 0
		function seek() {
			const row = bodyRef.current?.querySelector<HTMLElement>(
				`[data-settings-focus="${targetId}"]`
			)
			if (!row) {
				attempts += 1
				if (attempts < 40) frame = window.requestAnimationFrame(seek)
				return
			}
			pendingFocus.current = null
			row.scrollIntoView({ block: 'center' })
			flashRow(row)
			const control = row.querySelector<HTMLElement>(FOCUSABLE)
			;(control ?? row).focus({ preventScroll: true })
		}
		frame = window.requestAnimationFrame(seek)
		return () => window.cancelAnimationFrame(frame)
	}, [activeSection, searching])

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

	const goToSection = useCallback((id: SettingsSectionId) => {
		pendingFocus.current = null
		setQuery('')
		setActiveSection(id)
		bodyRef.current?.scrollTo({ top: 0 })
	}, [])

	const openResult = useCallback((result: SettingsSearchResult) => {
		if (result.kind === 'shortcut') setShortcutQuery(result.title)
		pendingFocus.current = result.kind === 'section' ? null : result.focusId
		setQuery('')
		setActiveSection(result.sectionId)
		if (result.kind === 'section') bodyRef.current?.scrollTo({ top: 0 })
	}, [])

	function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			if (!query) return
			event.preventDefault()
			setQuery('')
			return
		}
		if (results.length === 0) return
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setActiveResult((index) => (index + 1) % results.length)
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActiveResult((index) => (index - 1 + results.length) % results.length)
		} else if (event.key === 'Enter') {
			event.preventDefault()
			openResult(results[Math.min(activeResult, results.length - 1)])
		}
	}

	function renderScreen() {
		switch (activeSection) {
			case 'editor':
				return <EditorScreen />
			case 'appearance':
				return <AppearanceScreen />
			case 'shortcuts':
				return <ShortcutsScreen query={shortcutQuery} onQueryChange={setShortcutQuery} />
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
			case 'storage':
				return <StorageScreen />
			case 'updates':
				return <UpdatesScreen />
			case 'build-cache':
				return <BuildCacheScreen />
		}
	}

	const crumb = searching ? 'Search' : groupLabelOf(activeSection)
	const title = searching ? 'Search results' : section.title
	const description = searching
		? `${results.length} ${results.length === 1 ? 'match' : 'matches'} for “${query.trim()}”`
		: section.description

	return (
		<div className='flex h-full min-h-0 overflow-hidden bg-background'>
			<SettingsNav
				query={query}
				onQueryChange={setQuery}
				onSearchKeyDown={handleSearchKeyDown}
				searchRef={searchRef}
				activeSection={activeSection}
				visibleSections={navSections}
				matchCounts={matchCounts}
				onSelect={goToSection}
			/>

			<main className='flex min-h-0 min-w-0 flex-1 flex-col'>
				<header
					className='shrink-0 border-b border-border py-4'
					data-tauri-drag-region='true'
				>
					<div className='mx-auto flex w-full max-w-[880px] items-start gap-4 px-8'>
						<div className='min-w-0 flex-1'>
							<div className='mb-0.5 text-[11.5px] text-muted-foreground'>
								{crumb}
							</div>
							<h1 className='text-[17px] font-semibold tracking-tight text-foreground'>
								{title}
							</h1>
							<p className='mt-0.5 text-[12.5px] text-muted-foreground'>
								{description}
							</p>
						</div>
						{windowControls ? (
							<div className='shrink-0' data-tauri-drag-region='false'>
								{windowControls}
							</div>
						) : null}
					</div>
				</header>

				<div ref={bodyRef} className='@container min-h-0 flex-1 overflow-y-auto'>
					<div
						key={searching ? 'search' : activeSection}
						ref={screenRef}
						className='mx-auto w-full max-w-[880px] px-8 pb-10 pt-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-150 motion-reduce:animate-none'
					>
						{searching ? (
							<SearchResults
								query={query}
								results={results}
								activeIndex={activeResult}
								onOpen={openResult}
								onHover={setActiveResult}
								onClear={() => {
									setQuery('')
									searchRef.current?.focus()
								}}
							/>
						) : (
							renderScreen()
						)}
					</div>
				</div>
			</main>
		</div>
	)
}

export const SettingsPanel = SettingsView

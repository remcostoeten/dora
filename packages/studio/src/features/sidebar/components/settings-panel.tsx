import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
	type RefObject,
	type ReactNode
} from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useSettings, type SettingsState } from '@studio/core/settings'
import {
	APP_SHORTCUTS,
	SHORTCUT_CATEGORIES,
	formatShortcutList,
	useEffectiveShortcuts,
	useShortcutStore,
	type ShortcutDefinition,
	type ShortcutName
} from '@studio/core/shortcuts'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { Slider } from '@studio/shared/ui/slider'
import { Switch } from '@studio/shared/ui/switch'
import { cn } from '@studio/shared/utils/cn'
import { AiProviderSection } from '@studio/features/ai-assistant/ai-provider-section'
import { AiUsageSection } from '@studio/features/ai-assistant/ai-usage-section'
import { OllamaModelsSection } from '@studio/features/ai-assistant/ollama-models-section'
import { AppearanceControls } from './appearance-panel'
import { UpdateSection } from '@studio/features/updater/update-section'

import { AiKeysSection } from './ai-keys-section'
import { BuildCacheSection } from './build-cache-section'
import { ShortcutRecorder } from './shortcut-recorder'
import { StorageSection } from './storage-section'

type Props = {
	windowControls?: ReactNode
	initialSection?: SettingsSectionId
	// When set, open on the general Settings view and briefly pulse-highlight this
	// section (rather than deep-linking/focusing a specific control), so the user
	// can spot the feature they came to enable.
	highlightSection?: SettingsSectionId
}

export type SettingsSectionId =
	| 'editor'
	| 'appearance'
	| 'shortcuts'
	| 'ai-provider'
	| 'ollama-models'
	| 'ai-keys'
	| 'ai-usage'
	| 'storage'
	| 'build-cache'
	| 'safety'
	| 'startup'
	| 'interface'
	| 'updates'

type SettingsSectionNav = {
	id: SettingsSectionId
	title: string
	description: string
	keywords?: string[]
}

type SettingsSearchResult = {
	id: string
	sectionId: SettingsSectionId
	title: string
	description: string
	kind: 'section' | 'setting' | 'shortcut'
	focusId?: string
	keywords?: string[]
	sectionTitle?: string
	shortcutName?: ShortcutName
}

const SETTINGS_SECTIONS: SettingsSectionNav[] = [
	{
		id: 'editor',
		title: 'Editor',
		description: 'Font size, syntax theme, and Vim mode',
		keywords: ['font', 'theme', 'vim', 'code']
	},
	{
		id: 'appearance',
		title: 'Appearance',
		description: 'Theme, color shift, and app typography',
		keywords: ['theme', 'typography', 'colors', 'font']
	},
	{
		id: 'shortcuts',
		title: 'Shortcuts',
		description: 'Keyboard bindings and overrides',
		keywords: ['keyboard', 'hotkeys', 'keymap']
	},
	{
		id: 'ai-provider',
		title: 'AI Provider',
		description: 'Active model provider and defaults',
		keywords: ['openai', 'anthropic', 'gemini', 'groq', 'ollama', 'model']
	},
	{
		id: 'ollama-models',
		title: 'Local models',
		description: 'Ollama status, pulls, and installed models',
		keywords: ['ollama', 'download', 'install', 'model']
	},
	{
		id: 'ai-keys',
		title: 'AI Keys',
		description: 'Encrypted API keys per provider',
		keywords: ['api key', 'secret', 'token', 'credentials']
	},
	{
		id: 'ai-usage',
		title: 'AI Usage',
		description: 'Token totals, estimated cost, and recent requests',
		keywords: ['usage', 'tokens', 'cost', 'requests']
	},
	{
		id: 'storage',
		title: 'Storage',
		description: 'Database locations and switching',
		keywords: ['database', 'location', 'switch', 'file']
	},
	{
		id: 'build-cache',
		title: 'Build cache',
		description: 'Inspect and clean local Tauri build artifacts',
		keywords: ['cargo', 'target', 'bundle', 'cache', 'clean', 'size']
	},
	{
		id: 'safety',
		title: 'Safety',
		description: 'Destructive action confirmations',
		keywords: ['delete', 'confirm', 'danger']
	},
	{
		id: 'startup',
		title: 'Startup',
		description: 'Default connection behavior',
		keywords: ['launch', 'restore', 'connect', 'open']
	},
	{
		id: 'interface',
		title: 'Interface',
		description: 'Selection bar and toast behavior',
		keywords: ['selection', 'toasts', 'ui', 'layout']
	},
	{
		id: 'updates',
		title: 'Updates',
		description: 'Check for and install app updates',
		keywords: ['update', 'upgrade', 'version', 'release', 'about']
	}
]

const SETTING_SEARCH_ITEMS: SettingsSearchResult[] = [
	{
		id: 'setting-editor-font-size',
		sectionId: 'editor',
		title: 'Font size',
		description: 'Adjust editor text size',
		kind: 'setting',
		focusId: 'editor-font-size',
		keywords: ['typography', 'code', 'text size']
	},
	{
		id: 'setting-editor-syntax-theme',
		sectionId: 'editor',
		title: 'Syntax theme',
		description: 'Choose the editor color theme',
		kind: 'setting',
		focusId: 'editor-syntax-theme',
		keywords: ['theme', 'highlighting', 'colors']
	},
	{
		id: 'setting-editor-vim',
		sectionId: 'editor',
		title: 'Vim keybindings',
		description: 'Use Vim-style keyboard shortcuts',
		kind: 'setting',
		focusId: 'editor-vim-keybindings',
		keywords: ['vim', 'keyboard', 'mode']
	},
	{
		id: 'setting-safety-confirm-delete',
		sectionId: 'safety',
		title: 'Confirm before delete',
		description: 'Show confirmation for destructive actions',
		kind: 'setting',
		focusId: 'safety-confirm-before-delete',
		keywords: ['delete', 'destructive', 'danger']
	},
	{
		id: 'setting-startup-connection-behavior',
		sectionId: 'startup',
		title: 'Connection behavior',
		description: 'Auto-connect to the last database or start empty',
		kind: 'setting',
		focusId: 'startup-connection-behavior',
		keywords: ['startup', 'launch', 'restore', 'database']
	},
	{
		id: 'setting-startup-restore-tabs',
		sectionId: 'startup',
		title: 'Restore tabs on launch',
		description: 'Reopen tabs from the last session',
		kind: 'setting',
		focusId: 'startup-restore-tabs',
		keywords: ['tabs', 'session', 'launch']
	},
	{
		id: 'setting-interface-selection-bar',
		sectionId: 'interface',
		title: 'Selection Bar',
		description: 'Choose the style of the row selection bar',
		kind: 'setting',
		focusId: 'interface-selection-bar',
		keywords: ['rows', 'selection', 'layout']
	},
	{
		id: 'setting-build-cache-clean',
		sectionId: 'build-cache',
		title: 'Build cache',
		description: 'Inspect and clean Cargo target artifacts',
		kind: 'setting',
		focusId: 'build-cache-clean',
		keywords: ['cargo', 'target', 'bundle', 'cache', 'clean', 'size']
	},
	{
		id: 'setting-interface-show-toasts',
		sectionId: 'interface',
		title: 'Show Toasts',
		description: 'Enable or disable toast notifications',
		kind: 'setting',
		focusId: 'interface-show-toasts',
		keywords: ['notifications', 'toast', 'alerts']
	}
]

function normalizeSearchValue(value: string) {
	return value.trim().toLowerCase()
}

function getSectionTitle(id: SettingsSectionId) {
	return SETTINGS_SECTIONS.find(function (section) {
		return section.id === id
	})?.title
}

function getResultSearchText(result: SettingsSearchResult) {
	return [
		result.id,
		result.title,
		result.description,
		result.kind,
		result.sectionTitle,
		...(result.keywords ?? [])
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
}

function getShortcutCategory(name: ShortcutName) {
	for (const [category, names] of Object.entries(SHORTCUT_CATEGORIES)) {
		if (names.includes(name)) {
			return category
		}
	}

	return undefined
}

function getShortcutSearchResults(
	shortcuts: Record<ShortcutName, ShortcutDefinition>
): SettingsSearchResult[] {
	return Object.entries(shortcuts).map(function ([name, definition]) {
		const shortcutName = name as ShortcutName
		const comboText = Array.isArray(definition.combo)
			? definition.combo.join(' ')
			: definition.combo
		const category = getShortcutCategory(shortcutName)

		return {
			id: `shortcut-${name}`,
			sectionId: 'shortcuts',
			title: definition.description,
			description: [
				formatShortcutList(definition.combo),
				definition.scope,
				category
			].filter(Boolean).join(' · '),
			kind: 'shortcut',
			focusId: `shortcut-${name}`,
			shortcutName,
			sectionTitle: 'Shortcuts',
			keywords: [name, comboText, definition.scope ?? '', category ?? '']
		}
	})
}

function getSettingsSearchResults(
	shortcuts: Record<ShortcutName, ShortcutDefinition> = APP_SHORTCUTS
) {
	const sectionResults = SETTINGS_SECTIONS.map(function (section) {
		return {
			id: `section-${section.id}`,
			sectionId: section.id,
			title: section.title,
			description: section.description,
			kind: 'section' as const,
			focusId: `section-${section.id}`,
			keywords: section.keywords,
			sectionTitle: section.title
		}
	})
	const settingResults = SETTING_SEARCH_ITEMS.map(function (result) {
		return {
			...result,
			sectionTitle: getSectionTitle(result.sectionId)
		}
	})

	return [...sectionResults, ...settingResults, ...getShortcutSearchResults(shortcuts)]
}

function renderHighlightedText(
	text: string,
	query: string,
	highlightClassName = 'rounded bg-sidebar-primary/15 px-0.5 text-sidebar-foreground'
) {
	const normalizedQuery = normalizeSearchValue(query)
	if (!normalizedQuery) {
		return text
	}

	const normalizedText = text.toLowerCase()
	const nodes: ReactNode[] = []
	let cursor = 0

	while (cursor < text.length) {
		const matchIndex = normalizedText.indexOf(normalizedQuery, cursor)
		if (matchIndex < 0) {
			nodes.push(text.slice(cursor))
			break
		}

		if (matchIndex > cursor) {
			nodes.push(text.slice(cursor, matchIndex))
		}

		const matchEnd = matchIndex + normalizedQuery.length
		nodes.push(
			<span key={`${matchIndex}-${matchEnd}`} className={highlightClassName}>
				{text.slice(matchIndex, matchEnd)}
			</span>
		)
		cursor = matchEnd
	}

	return nodes.length === 1 ? nodes[0] : nodes
}

export function getAutocompleteSuffix(title: string, query: string) {
	const normalizedQuery = normalizeSearchValue(query)
	if (!normalizedQuery) {
		return title
	}

	if (!title.toLowerCase().startsWith(normalizedQuery)) {
		return ''
	}

	return title.slice(query.length)
}

export function filterSections(query: string) {
	const normalizedQuery = normalizeSearchValue(query)
	if (!normalizedQuery) {
		return SETTINGS_SECTIONS
	}

	const matchingSectionIds = new Set(
		filterSettingsSearchResults(query).map(function (result) {
			return result.sectionId
		})
	)

	return SETTINGS_SECTIONS.filter(function (section) {
		return matchingSectionIds.has(section.id)
	})
}

export function filterSettingsSearchResults(
	query: string,
	shortcuts: Record<ShortcutName, ShortcutDefinition> = APP_SHORTCUTS
) {
	const normalizedQuery = normalizeSearchValue(query)
	const results = getSettingsSearchResults(shortcuts)

	if (!normalizedQuery) {
		return results.filter(function (result) {
			return result.kind === 'section'
		})
	}

	return results.filter(function (result) {
		return getResultSearchText(result).includes(normalizedQuery)
	})
}

function SettingsNavButton({
	result,
	active,
	query,
	onClick
}: {
	result: SettingsSearchResult
	active: boolean
	query: string
	onClick: () => void
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'group flex w-full items-start border-l-2 px-3 py-2 text-left transition-colors',
				active
					? 'border-sidebar-primary bg-sidebar-accent/60 text-sidebar-foreground'
					: 'border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/35 hover:text-sidebar-foreground'
			)}
		>
			<span className='min-w-0'>
				<span className='block text-sm font-medium'>
					{renderHighlightedText(result.title, query)}
				</span>
				<span className='mt-0.5 block text-[11px] leading-tight text-muted-foreground'>
					{renderHighlightedText(
						result.description,
						query,
						'rounded bg-sidebar-primary/10 px-0.5 text-sidebar-foreground'
					)}
				</span>
				{result.kind !== 'section' ? (
					<span className='mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground/70'>
						{result.kind === 'shortcut' ? 'Shortcut' : 'Setting'} · {result.sectionTitle}
					</span>
				) : null}
			</span>
		</button>
	)
}

function SettingsSearchField({
	query,
	onQueryChange,
	onClear,
	onPrevious,
	onNext,
	onOpenResult,
	inputRef,
	onKeyDown,
	matchIndex,
	matchCount,
	suggestions,
	totalCount,
	disabled
}: {
	query: string
	onQueryChange: (value: string) => void
	onClear: () => void
	onPrevious: () => void
	onNext: () => void
	onOpenResult: (index: number) => void
	inputRef: RefObject<HTMLInputElement>
	onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
	matchIndex: number
	matchCount: number
	suggestions: SettingsSearchResult[]
	totalCount: number
	disabled: boolean
}) {
	const hasQuery = query.trim().length > 0
	const inlineSuggestion = suggestions[matchIndex] ?? suggestions[0]
	const autocompleteSuffix = inlineSuggestion
		? getAutocompleteSuffix(inlineSuggestion.title, query)
		: ''

	return (
		<div className='space-y-2 border-b border-sidebar-border px-3 py-3'>
			<div className='relative'>
				<Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
				{inlineSuggestion ? (
					<div className='pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden pl-9 pr-16'>
						<div className='whitespace-pre text-sm leading-8'>
							<span className='invisible'>{query || ' '}</span>
							<span className='text-muted-foreground/45'>
								{autocompleteSuffix || (hasQuery ? inlineSuggestion.title : '')}
							</span>
						</div>
					</div>
				) : null}
				<Input
					ref={inputRef}
					value={query}
					onChange={function (event) {
						onQueryChange(event.target.value)
					}}
					onKeyDown={onKeyDown}
					placeholder='Search settings'
					aria-label='Search settings'
					className='relative z-10 h-8 border-sidebar-border/60 bg-sidebar/90 pl-9 pr-16 text-sm text-sidebar-foreground placeholder:text-muted-foreground/70 focus-visible:border-sidebar-border focus-visible:ring-1 focus-visible:ring-sidebar-ring'
				/>
				{hasQuery ? (
					<div className='absolute inset-y-0 right-1 flex items-center gap-0.5'>
						<Button
							type='button'
							variant='ghost'
							size='icon-sm'
							onClick={onPrevious}
							disabled={disabled}
							className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
							aria-label='Previous match'
						>
							<ChevronUp className='h-3.5 w-3.5' />
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon-sm'
							onClick={onNext}
							disabled={disabled}
							className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
							aria-label='Next match'
						>
							<ChevronDown className='h-3.5 w-3.5' />
						</Button>
					</div>
				) : null}
			</div>

			{suggestions.length > 0 ? (
				<div className='space-y-1'>
					<div className='flex items-center justify-between px-1 text-[10px] uppercase tracking-wider text-muted-foreground'>
						<span>Autocomplete</span>
						<span>Tab focuses</span>
					</div>
					<div className='flex flex-wrap gap-1'>
						{suggestions.slice(0, 3).map(function (result, index) {
							const isActive = suggestions[matchIndex]?.id === result.id
							return (
								<Button
									key={result.id}
									type='button'
									variant={isActive ? 'sidebar' : 'ghost'}
									size='sm'
									className='h-7 gap-1.5 px-2 text-[11px]'
									onClick={function () {
										onOpenResult(index)
									}}
								>
									<kbd className='pointer-events-none inline-flex h-4 select-none items-center rounded border border-border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground'>
										{isActive ? 'Tab' : `⌃${index + 1}`}
									</kbd>
									<span className='truncate'>{result.title}</span>
								</Button>
							)
						})}
					</div>
				</div>
			) : null}

			<div className='flex items-center justify-between gap-2 text-[11px] text-muted-foreground'>
				<span>
					{matchCount} / {totalCount} results
				</span>
				<div className='flex items-center gap-1'>
					{hasQuery ? (
						<>
							<span className='tabular-nums'>
								{matchCount === 0
									? 'No matches'
									: `${matchIndex >= 0 ? matchIndex + 1 : 1} of ${matchCount}`}
							</span>
							<Button
								type='button'
								variant='ghost'
								size='icon-sm'
								onClick={onClear}
								className='h-6 w-6 text-muted-foreground hover:text-sidebar-foreground'
								aria-label='Clear search'
							>
								<X className='h-3.5 w-3.5' />
							</Button>
						</>
					) : (
						<span>Browse or search in place</span>
					)}
				</div>
			</div>
		</div>
	)
}

function SectionCard({
	id,
	title,
	description,
	children,
	sectionRef,
	onFocusReturn,
	query
}: {
	id: SettingsSectionId
	title: string
	description: ReactNode
	children: ReactNode
	sectionRef?: (node: HTMLElement | null) => void
	onFocusReturn: () => void
	query: string
}) {
	return (
		<section
			id={id}
			ref={sectionRef}
			tabIndex={-1}
			data-settings-focus={`section-${id}`}
			onKeyDown={function (event) {
				if (event.key !== 'Tab' || !event.shiftKey) return
				const target = event.target as HTMLElement | null
				const searchTarget = target?.closest('[data-settings-search-target="true"]')
				if (!searchTarget || !event.currentTarget.contains(searchTarget)) return

				event.preventDefault()
				onFocusReturn()
			}}
			className='scroll-mt-0 border-b border-sidebar-border px-5 py-4 last:border-b-0'
		>
			<div className='mb-4 flex items-start justify-between gap-4'>
				<div>
					<h2 className='text-sm font-semibold text-sidebar-foreground'>
						{renderHighlightedText(title, query)}
					</h2>
					<p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
						{description}
					</p>
				</div>
			</div>
			{children}
		</section>
	)
}

export function SettingsView({ windowControls, initialSection, highlightSection }: Props = {}) {
	const { settings, updateSetting } = useSettings()
	const { setShortcut, resetShortcut, overrides } = useShortcutStore()
	const effectiveShortcuts = useEffectiveShortcuts()
	const initialSectionHandled = useRef(false)
	const [activeSection, setActiveSection] = useState<SettingsSectionId>(
		initialSection ?? 'editor'
	)
	const [searchQuery, setSearchQuery] = useState('')
	const [shortcutSearchQuery, setShortcutSearchQuery] = useState('')
	const [activeShortcutIndex, setActiveShortcutIndex] = useState(0)
	const [activeMatchIndex, setActiveMatchIndex] = useState(0)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const shortcutInputRef = useRef<HTMLInputElement>(null)
	const sectionRefs = useRef<Partial<Record<SettingsSectionId, HTMLElement | null>>>({})

	const sectionCount = useMemo(() => SETTINGS_SECTIONS.length, [])
	const totalSearchResultCount = useMemo(function () {
		return getSettingsSearchResults(effectiveShortcuts).length
	}, [effectiveShortcuts])
	const searchResults = useMemo(function () {
		return filterSettingsSearchResults(searchQuery, effectiveShortcuts)
	}, [searchQuery, effectiveShortcuts])
	const visibleSections = useMemo(function () {
		const visibleSectionIds = new Set(searchResults.map(function (result) {
			return result.sectionId
		}))
		return SETTINGS_SECTIONS.filter(function (section) {
			return visibleSectionIds.has(section.id)
		})
	}, [searchResults])
	const visibleSectionIds = useMemo(function () {
		return new Set(visibleSections.map(function (section) {
			return section.id
		}))
	}, [visibleSections])
	const shortcutSuggestionsByCategory = useMemo(function () {
		const q = shortcutSearchQuery.trim().toLowerCase()
		if (!q) return null
		return Object.entries(SHORTCUT_CATEGORIES).map(function ([category, names]) {
			const filtered = names.filter(function (name) {
				const def = effectiveShortcuts[name]
				if (!def) return false
				const comboStr = Array.isArray(def.combo) ? def.combo.join(' ') : def.combo
				return (
					def.description.toLowerCase().includes(q) ||
					comboStr.toLowerCase().includes(q)
				)
			})
			return { category, names: filtered.map(function (n) { return { name: n, def: effectiveShortcuts[n] } }) }
		}).filter(function (g) { return g.names.length > 0 })
	}, [shortcutSearchQuery, effectiveShortcuts])
	const shortcutSuggestions = useMemo(function () {
		if (!shortcutSuggestionsByCategory) return []
		return shortcutSuggestionsByCategory.flatMap(function (g) { return g.names })
	}, [shortcutSuggestionsByCategory])
	const selectedMatchIndex = activeMatchIndex >= 0 ? activeMatchIndex : 0

	const focusSearchInput = useCallback(function () {
		searchInputRef.current?.focus()
		searchInputRef.current?.select()
	}, [])

	const focusSearchResult = useCallback(function (result: SettingsSearchResult) {
		setActiveSection(result.sectionId)

		if (result.kind === 'shortcut') {
			setShortcutSearchQuery(result.title)
			setActiveShortcutIndex(0)
		}

		window.requestAnimationFrame(function () {
			window.requestAnimationFrame(function () {
				const section = sectionRefs.current[result.sectionId]
				const target = result.focusId
					? section?.querySelector<HTMLElement>(`[data-settings-focus="${result.focusId}"]`)
					: section
				const focusable = target?.querySelector<HTMLElement>(
					'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
				)
				section?.querySelectorAll('[data-settings-search-target="true"]').forEach(function (node) {
					node.removeAttribute('data-settings-search-target')
				})

				target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
				target?.setAttribute('data-settings-search-target', 'true')
				;(result.kind === 'section' ? target : focusable ?? target)?.focus()
				})
			})
	}, [])

	const focusSelectedSearchResult = useCallback(function () {
		const target = searchResults[selectedMatchIndex] ?? searchResults[0]
		if (!target) return

		setActiveMatchIndex(searchResults.indexOf(target))
		focusSearchResult(target)
	}, [focusSearchResult, searchResults, selectedMatchIndex])

	const focusSectionByOffset = useCallback(
		function (offset: number) {
			if (!searchResults.length) return

			const currentIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : 0
			const nextIndex = (currentIndex + offset + searchResults.length) % searchResults.length
			setActiveMatchIndex(nextIndex)
			setActiveSection(searchResults[nextIndex].sectionId)
		},
		[searchResults, selectedMatchIndex]
	)

	const handleSearchKeyDown = useCallback(
		function (event: React.KeyboardEvent<HTMLInputElement>) {
			if ((event.ctrlKey || event.altKey) && /^[1-3]$/.test(event.key)) {
				const shortcutIndex = Number(event.key) - 1
				const target = searchResults[shortcutIndex]
				if (target) {
					event.preventDefault()
					setActiveMatchIndex(shortcutIndex)
					setActiveSection(target.sectionId)
				}
				return
			}

			if (event.key === 'Tab') {
				if (!event.shiftKey) {
					event.preventDefault()
					focusSelectedSearchResult()
				}
				return
			}

			if (event.key === 'Enter') {
				event.preventDefault()
				focusSelectedSearchResult()
				return
			}

			if (event.key === 'ArrowDown') {
				event.preventDefault()
				focusSectionByOffset(1)
				return
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault()
				focusSectionByOffset(-1)
				return
			}

			if (event.key === 'Home') {
				event.preventDefault()
				if (searchResults[0]) {
					setActiveMatchIndex(0)
					setActiveSection(searchResults[0].sectionId)
				}
				return
			}

			if (event.key === 'End') {
				event.preventDefault()
				const lastIndex = searchResults.length - 1
				const lastResult = searchResults[lastIndex]
				if (lastResult) {
					setActiveMatchIndex(lastIndex)
					setActiveSection(lastResult.sectionId)
				}
				return
			}

			if (event.key === 'Escape') {
				if (searchQuery) {
					event.preventDefault()
					setSearchQuery('')
				}
			}
		},
		[focusSectionByOffset, focusSelectedSearchResult, searchQuery, searchResults]
	)

	useEffect(
		function scrollActiveSectionIntoView() {
			if (!initialSectionHandled.current && initialSection && sectionRefs.current[initialSection]) {
				sectionRefs.current[initialSection]?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				})
				initialSectionHandled.current = true
			} else {
				sectionRefs.current[activeSection]?.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				})
			}
		},
		[activeSection, initialSection]
	)

	useEffect(
		function pulseHighlightedSection() {
			if (!highlightSection) return

			setActiveSection(highlightSection)

			let removeTimer: number | undefined
			const raf = window.requestAnimationFrame(function () {
				const node = sectionRefs.current[highlightSection]
				if (!node) return
				node.scrollIntoView({ behavior: 'smooth', block: 'start' })
				node.classList.add('settings-section-highlight')
				removeTimer = window.setTimeout(function () {
					node.classList.remove('settings-section-highlight')
				}, 2400)
			})

			return function () {
				window.cancelAnimationFrame(raf)
				if (removeTimer) window.clearTimeout(removeTimer)
			}
		},
		[highlightSection]
	)

	useEffect(
		function keepActiveSectionVisible() {
			if (!visibleSections.length) {
				return
			}

			if (visibleSectionIds.has(activeSection)) {
				return
			}

			setActiveSection(visibleSections[0].id)
		},
		[activeSection, visibleSectionIds, visibleSections]
	)

	useEffect(
		function resetAutocompleteIndex() {
			setActiveMatchIndex(0)
		},
		[searchQuery]
	)

	useEffect(
		function resetShortcutAutocompleteIndex() {
			setActiveShortcutIndex(0)
		},
		[shortcutSearchQuery]
	)

	useEffect(function bindSearchShortcut() {
		function handleKeyDown(event: globalThis.KeyboardEvent) {
			const isRecordingShortcut =
				document.querySelector('[data-shortcut-recording="true"]') !== null
			const isFindShortcut =
				(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f'
			const isSlashShortcut =
				!event.metaKey &&
				!event.ctrlKey &&
				!event.altKey &&
				event.key === '/' &&
				!isRecordingShortcut

			if (!isFindShortcut && !isSlashShortcut) {
				return
			}

			event.preventDefault()
			focusSearchInput()
		}

		window.addEventListener('keydown', handleKeyDown)
		return function () {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [focusSearchInput])

	function registerSectionRef(id: SettingsSectionId) {
		return function (node: HTMLElement | null) {
			sectionRefs.current[id] = node
		}
	}

	return (
		<div className='flex h-full min-h-0 overflow-hidden bg-background'>
			<aside className='flex w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar'>
				<div className='flex h-16 flex-col justify-center border-b border-sidebar-border px-3'>
					<div className='text-sm font-semibold text-sidebar-foreground'>Settings</div>
					<div className='mt-0.5 text-xs text-muted-foreground'>
						{sectionCount} sections
					</div>
				</div>
				<SettingsSearchField
					query={searchQuery}
					onQueryChange={setSearchQuery}
					onClear={function () {
						setSearchQuery('')
						searchInputRef.current?.focus()
					}}
					onPrevious={function () {
						focusSectionByOffset(-1)
					}}
					onNext={function () {
						focusSectionByOffset(1)
					}}
					onOpenResult={function (index) {
						const target = searchResults[index]
						if (!target) return
						setActiveMatchIndex(index)
						focusSearchResult(target)
					}}
					inputRef={searchInputRef}
					onKeyDown={handleSearchKeyDown}
					matchIndex={selectedMatchIndex}
					matchCount={searchResults.length}
					suggestions={searchResults}
					totalCount={totalSearchResultCount}
					disabled={searchResults.length === 0}
				/>
				<div className='min-h-0 flex-1 overflow-y-auto py-2'>
					<div>
							{searchResults.length > 0 ? (
								searchResults.map(function (result) {
									return (
										<SettingsNavButton
											key={result.id}
											result={result}
											active={searchResults[selectedMatchIndex]?.id === result.id}
											query={searchQuery}
											onClick={function () {
												const nextIndex = searchResults.findIndex(function (item) {
													return item.id === result.id
												})
												if (nextIndex >= 0) {
													setActiveMatchIndex(nextIndex)
												}
												focusSearchResult(result)
											}}
										/>
									)
							})
						) : (
							<div className='px-3 py-3 text-xs leading-relaxed text-muted-foreground'>
								No settings match this search. Clear the query to see everything again.
							</div>
						)}
					</div>
				</div>
			</aside>

			<main className='flex min-w-0 flex-1 flex-col min-h-0'>
				<div
					className='flex h-16 items-center justify-between gap-4 border-b border-border bg-sidebar/20 px-5'
					data-tauri-drag-region='true'
				>
					<div className='min-w-0'>
						<h1 className='text-base font-semibold text-sidebar-foreground'>
							Application settings
						</h1>
						<p className='mt-0.5 text-xs text-muted-foreground'>
							Appearance, editor behavior, shortcuts, AI keys, storage, and interface preferences
						</p>
					</div>
					{windowControls ? (
						<div className='shrink-0' data-tauri-drag-region='false'>
							{windowControls}
						</div>
					) : null}
				</div>

				<div className='min-h-0 flex-1 overflow-hidden'>
					<div className='h-full overflow-y-auto'>
						<div>
							{visibleSections.length === 0 ? (
								<div className='flex h-full min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center'>
									<div className='max-w-sm space-y-2'>
										<div className='text-sm font-medium text-sidebar-foreground'>
											No matching settings
										</div>
										<p className='text-sm leading-relaxed text-muted-foreground'>
											Search terms only hide sections in place. Clear the filter to restore the full settings view.
										</p>
									</div>
									<Button
										type='button'
										variant='outline'
										size='sm'
										onClick={function () {
											setSearchQuery('')
											searchInputRef.current?.focus()
										}}
									>
										Clear search
									</Button>
								</div>
							) : null}

							{visibleSectionIds.has('editor') ? (
								<SectionCard
									id='editor'
									title='Editor'
									description={renderHighlightedText(
										'Control editor typography, syntax highlighting, and Vim mode.',
										searchQuery
									)}
									sectionRef={registerSectionRef('editor')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div className='space-y-4'>
										<div
											className='space-y-2'
											tabIndex={-1}
											data-settings-focus='editor-font-size'
										>
											<div className='flex items-center justify-between'>
												<span className='text-sm text-sidebar-foreground'>Font size</span>
												<span className='text-sm font-mono text-sidebar-foreground'>
													{settings.editorFontSize}px
												</span>
											</div>
											<div className='flex items-center gap-3'>
												<span className='text-xs text-muted-foreground'>A</span>
												<Slider
													value={[settings.editorFontSize]}
													onValueChange={function ([value]) {
														updateSetting('editorFontSize', value)
													}}
													min={10}
													max={24}
													step={1}
												/>
												<span className='text-base text-muted-foreground'>A</span>
											</div>
										</div>

										<div
											className='space-y-2'
											tabIndex={-1}
											data-settings-focus='editor-syntax-theme'
										>
											<div className='text-sm text-sidebar-foreground'>Syntax theme</div>
											<Select
												value={settings.editorTheme}
												onValueChange={function (value) {
													updateSetting(
														'editorTheme',
														value as SettingsState['editorTheme']
													)
												}}
											>
												<SelectTrigger className='h-8 w-full text-xs'>
													<SelectValue placeholder='Select theme' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='auto'>Auto (System)</SelectItem>
													<SelectItem value='vs'>Light (Default)</SelectItem>
													<SelectItem value='vs-dark'>Dark (Default)</SelectItem>
													<SelectSeparator />
													<SelectItem value='dracula'>Dracula</SelectItem>
													<SelectItem value='nord'>Nord</SelectItem>
													<SelectItem value='monokai'>Monokai</SelectItem>
													<SelectItem value='github-dark'>GitHub Dark</SelectItem>
													<SelectItem value='github-light'>GitHub Light</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div
											className='flex items-start justify-between gap-4'
											tabIndex={-1}
											data-settings-focus='editor-vim-keybindings'
										>
											<div className='flex-1'>
												<div className='text-sm text-sidebar-foreground'>
													Vim keybindings
												</div>
												<div className='text-xs leading-tight text-muted-foreground'>
													Use Vim-style keyboard shortcuts
												</div>
											</div>
											<div className='flex-shrink-0 pt-0.5'>
												<Switch
													checked={settings.enableVimMode}
													onCheckedChange={function (checked) {
														updateSetting('enableVimMode', checked)
													}}
												/>
											</div>
										</div>
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('appearance') ? (
								<SectionCard
									id='appearance'
									title='Appearance'
									description={renderHighlightedText(
										'Choose the app theme, global color shift, and typography.',
										searchQuery
									)}
									sectionRef={registerSectionRef('appearance')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<AppearanceControls />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('shortcuts') ? (
								<SectionCard
									id='shortcuts'
									title='Shortcuts'
									description={renderHighlightedText(
										'View and edit the keyboard bindings that control the app.',
										searchQuery
									)}
									sectionRef={registerSectionRef('shortcuts')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div className='space-y-4'>
										<div className='relative'>
											<Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60' />
											{shortcutSuggestions[activeShortcutIndex] ? (
												<div className='pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden pl-8 pr-16'>
													<div className='whitespace-pre text-xs leading-8'>
														<span className='invisible'>{shortcutSearchQuery || ' '}</span>
														<span className='text-muted-foreground/45'>
															{shortcutSuggestions[activeShortcutIndex].def.description.slice(shortcutSearchQuery.length)}
														</span>
													</div>
												</div>
											) : null}
											<Input
												ref={shortcutInputRef}
												value={shortcutSearchQuery}
												onChange={function (e) {
													setShortcutSearchQuery(e.target.value)
												}}
												onKeyDown={function (e) {
													if (e.key === 'Tab' && shortcutSuggestions.length > 0) {
														e.preventDefault()
														const suggestion = shortcutSuggestions[activeShortcutIndex] ?? shortcutSuggestions[0]
														setShortcutSearchQuery(suggestion.def.description)
														setActiveShortcutIndex(0)
														return
													}
													if (e.key === 'ArrowDown') {
														e.preventDefault()
														setActiveShortcutIndex(function (prev) {
															return Math.min(prev + 1, shortcutSuggestions.length - 1)
														})
														return
													}
													if (e.key === 'ArrowUp') {
														e.preventDefault()
														setActiveShortcutIndex(function (prev) {
															return Math.max(prev - 1, 0)
														})
														return
													}
												}}
												placeholder='Search shortcuts…'
												className='h-8 pl-8 text-xs'
											/>
											{shortcutSearchQuery && (
												<button
													type='button'
													aria-label='Clear shortcut search'
													onClick={function () {
														setShortcutSearchQuery('')
													}}
													className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors'
												>
													<X className='h-3.5 w-3.5' />
												</button>
											)}
										</div>
										{Object.entries(SHORTCUT_CATEGORIES).map(function ([category, names]) {
											const q = shortcutSearchQuery.trim().toLowerCase()
											const filtered = q
												? names.filter(function (name) {
														const def = effectiveShortcuts[name]
														if (!def) return false
														const comboStr = Array.isArray(def.combo) ? def.combo.join(' ') : def.combo
														return (
															def.description.toLowerCase().includes(q) ||
															comboStr.toLowerCase().includes(q)
														)
													})
												: names
											if (filtered.length === 0) return null
											return (
												<div key={category} className='space-y-2'>
													<div className='px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground'>
														{category}
													</div>
													<div className='space-y-1'>
														{filtered.map(function (name) {
															const def = effectiveShortcuts[name]
															if (!def) return null
															const isDefault = !overrides[name]
															const flatIndex = shortcutSuggestions.findIndex(function (s) {
																return s.name === name
															})
															const isActive = flatIndex === activeShortcutIndex
															return (
																<div
																	key={name}
																	tabIndex={-1}
																	data-settings-focus={`shortcut-${name}`}
																	ref={isActive ? function (el) {
																		if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
																	} : undefined}
																	className={cn(
																		'flex items-center justify-between gap-4 rounded-sm px-2 py-1.5 transition-colors',
																		isActive
																			? 'bg-sidebar-accent/60 ring-1 ring-sidebar-primary/30'
																			: 'hover:bg-sidebar-accent/30'
																	)}
																>
																	<div className='min-w-0 flex-1'>
																		<div className='truncate text-sm text-sidebar-foreground'>
																			{def.description}
																		</div>
																		{!isDefault && (
																			<div className='text-[10px] text-muted-foreground'>
																				customized
																			</div>
																		)}
																	</div>
																	<ShortcutRecorder
																		value={def.combo}
																		onChange={function (newCombo) {
																			setShortcut(name, newCombo)
																		}}
																		onReset={function () {
																			resetShortcut(name)
																		}}
																		isDefault={isDefault}
																		actionLabel={def.description}
																	/>
																</div>
															)
														})}
													</div>
												</div>
											)
										})}
										{shortcutSearchQuery.trim() && shortcutSuggestions.length === 0 && (
											<div className='px-1 py-2 text-xs text-muted-foreground/70'>
												No shortcuts match &ldquo;{shortcutSearchQuery.trim()}&rdquo;
											</div>
										)}
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('ai-provider') ? (
								<SectionCard
									id='ai-provider'
									title='AI Provider'
									description={renderHighlightedText(
										'Choose the active provider and model used by the assistant.',
										searchQuery
									)}
									sectionRef={registerSectionRef('ai-provider')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<AiProviderSection />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('ollama-models') ? (
								<SectionCard
									id='ollama-models'
									title='Local models'
									description={renderHighlightedText(
										'Install and manage Ollama models on this machine.',
										searchQuery
									)}
									sectionRef={registerSectionRef('ollama-models')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<OllamaModelsSection />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('ai-keys') ? (
								<SectionCard
									id='ai-keys'
									title='AI Keys'
									description={renderHighlightedText(
										'Store and verify encrypted API keys.',
										searchQuery
									)}
									sectionRef={registerSectionRef('ai-keys')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<AiKeysSection />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('ai-usage') ? (
								<SectionCard
									id='ai-usage'
									title='AI Usage'
									description={renderHighlightedText(
										'Track requests, tokens, and estimated spend across providers.',
										searchQuery
									)}
									sectionRef={registerSectionRef('ai-usage')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<AiUsageSection />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('storage') ? (
								<SectionCard
									id='storage'
									title='Storage'
									description={renderHighlightedText(
										'Inspect and switch local database storage targets.',
										searchQuery
									)}
									sectionRef={registerSectionRef('storage')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<StorageSection />
								</SectionCard>
							) : null}

							{visibleSectionIds.has('build-cache') ? (
								<SectionCard
									id='build-cache'
									title='Build cache'
									description={renderHighlightedText(
										'Inspect and clean local Tauri build artifacts.',
										searchQuery
									)}
									sectionRef={registerSectionRef('build-cache')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div tabIndex={-1} data-settings-focus='build-cache-clean'>
										<BuildCacheSection />
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('safety') ? (
								<SectionCard
									id='safety'
									title='Safety'
									description={renderHighlightedText(
										'Control confirmation prompts for destructive actions.',
										searchQuery
									)}
									sectionRef={registerSectionRef('safety')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div
										className='flex items-start justify-between gap-4'
										tabIndex={-1}
										data-settings-focus='safety-confirm-before-delete'
									>
										<div className='flex-1'>
											<div className='text-sm text-sidebar-foreground'>
												Confirm before delete
											</div>
											<div className='text-xs leading-tight text-muted-foreground'>
												Show confirmation for destructive actions
											</div>
										</div>
										<div className='flex-shrink-0 pt-0.5'>
											<Switch
												checked={settings.confirmBeforeDelete}
												onCheckedChange={function (checked) {
													updateSetting('confirmBeforeDelete', checked)
												}}
											/>
										</div>
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('startup') ? (
								<SectionCard
									id='startup'
									title='Startup'
									description={renderHighlightedText(
										'Choose how the app behaves when it launches.',
										searchQuery
									)}
									sectionRef={registerSectionRef('startup')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div
										className='space-y-2'
										tabIndex={-1}
										data-settings-focus='startup-connection-behavior'
									>
										<div className='flex-1'>
											<div className='text-sm text-sidebar-foreground'>
												Connection behavior
											</div>
											<div className='text-xs leading-tight text-muted-foreground'>
												Auto-connect to the last used database, or start on an empty view
											</div>
										</div>
										<div className='min-w-[160px] flex-shrink-0 pt-0.5'>
											<Select
												value={settings.startupConnectionMode || 'auto'}
												onValueChange={function (value) {
													const mode = value as 'auto' | 'empty'
													updateSetting('startupConnectionMode', mode)
													updateSetting('restoreLastConnection', mode === 'auto')
												}}
											>
												<SelectTrigger className='h-8 w-full text-xs'>
													<SelectValue placeholder='Select startup mode' />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value='auto'>Auto-connect</SelectItem>
													<SelectItem value='empty'>Start empty</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<div
										className='flex items-start justify-between gap-4'
										tabIndex={-1}
										data-settings-focus='startup-restore-tabs'
									>
										<div className='flex-1'>
											<div className='text-sm text-sidebar-foreground'>
												Restore tabs on launch
											</div>
											<div className='text-xs leading-tight text-muted-foreground'>
												Reopen your tabs from the last session. Pinned tabs always restore.
											</div>
										</div>
										<div className='flex-shrink-0 pt-0.5'>
											<Switch
												checked={settings.restoreTabsOnLaunch}
												onCheckedChange={function (checked) {
													updateSetting('restoreTabsOnLaunch', checked)
												}}
											/>
										</div>
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('interface') ? (
								<SectionCard
									id='interface'
									title='Interface'
									description={renderHighlightedText(
										'Tune row selection and toast behavior.',
										searchQuery
									)}
									sectionRef={registerSectionRef('interface')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<div className='space-y-4'>
										<div
											className='flex items-start justify-between gap-4'
											tabIndex={-1}
											data-settings-focus='interface-selection-bar'
										>
											<div className='flex-1'>
												<div className='text-sm text-sidebar-foreground'>
													Selection Bar
												</div>
												<div className='text-xs leading-tight text-muted-foreground'>
													Choose the style of the row selection bar
												</div>
											</div>
											<div className='min-w-[120px] flex-shrink-0 pt-0.5'>
												<Select
													value={settings.selectionBarStyle || 'static'}
													onValueChange={function (value) {
														updateSetting(
															'selectionBarStyle',
															value as SettingsState['selectionBarStyle']
														)
													}}
												>
													<SelectTrigger className='h-8 w-full text-xs'>
														<SelectValue placeholder='Select style' />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='floating'>Floating Pill</SelectItem>
														<SelectItem value='static'>Static Bar</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<div
											className='flex items-start justify-between gap-4'
											tabIndex={-1}
											data-settings-focus='interface-show-toasts'
										>
											<div className='flex-1'>
												<div className='text-sm text-sidebar-foreground'>
													Show Toasts
												</div>
												<div className='text-xs leading-tight text-muted-foreground'>
													Enable or disable toast notifications
												</div>
											</div>
											<div className='flex-shrink-0 pt-0.5'>
												<Switch
													checked={settings.showToasts !== false}
													onCheckedChange={function (checked) {
														updateSetting('showToasts', checked)
													}}
												/>
											</div>
										</div>
									</div>
								</SectionCard>
							) : null}

							{visibleSectionIds.has('updates') ? (
								<SectionCard
									id='updates'
									title='Updates'
									description={renderHighlightedText(
										'Check for and install new versions of the app.',
										searchQuery
									)}
									sectionRef={registerSectionRef('updates')}
									onFocusReturn={focusSearchInput}
									query={searchQuery}
								>
									<UpdateSection />
								</SectionCard>
							) : null}
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

export const SettingsPanel = SettingsView

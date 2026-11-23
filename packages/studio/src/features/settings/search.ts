import {
	APP_SHORTCUTS,
	SHORTCUT_CATEGORIES,
	formatShortcutList,
	type ShortcutDefinition,
	type ShortcutName
} from '@studio/core/shortcuts'
import { SETTINGS_SECTIONS, type SettingsSectionId } from './sections'

export type SettingsSearchResult = {
	id: string
	sectionId: SettingsSectionId
	title: string
	description: string
	kind: 'section' | 'setting' | 'shortcut'
	focusId: string
	keywords: string[]
	shortcutName?: ShortcutName
}

type SettingEntry = Omit<SettingsSearchResult, 'id' | 'kind'>

const SETTING_ENTRIES: SettingEntry[] = [
	{
		sectionId: 'editor',
		title: 'Font size',
		description: 'Size of text in the SQL editor',
		focusId: 'editor-font-size',
		keywords: ['typography', 'code', 'text size', 'zoom']
	},
	{
		sectionId: 'editor',
		title: 'Syntax theme',
		description: 'Colors used for SQL highlighting',
		focusId: 'editor-syntax-theme',
		keywords: ['theme', 'highlighting', 'colors', 'dracula', 'nord', 'monokai', 'github']
	},
	{
		sectionId: 'editor',
		title: 'Vim keybindings',
		description: 'Use Vim-style keyboard shortcuts',
		focusId: 'editor-vim-keybindings',
		keywords: ['vim', 'keyboard', 'mode', 'modal']
	},
	{
		sectionId: 'appearance',
		title: 'Theme',
		description: 'Color scheme for the whole app',
		focusId: 'appearance-theme',
		keywords: ['dark', 'light', 'midnight', 'forest', 'bloom', 'claude', 'night', 'colors']
	},
	{
		sectionId: 'appearance',
		title: 'Color shift',
		description: 'Rotate the hue of tinted themes',
		focusId: 'appearance-color-shift',
		keywords: ['hue', 'tint', 'colors']
	},
	{
		sectionId: 'appearance',
		title: 'App typography',
		description: 'Font pairing for the interface and for code',
		focusId: 'appearance-typography',
		keywords: ['font', 'typeface', 'serif', 'mono', 'inter', 'plex', 'nunito']
	},
	{
		sectionId: 'ai-provider',
		title: 'Active provider',
		description: 'Which AI service answers questions and writes SQL',
		focusId: 'ai-provider-provider',
		keywords: ['openai', 'anthropic', 'gemini', 'groq', 'deepseek', 'ollama', 'openrouter']
	},
	{
		sectionId: 'ai-provider',
		title: 'Model',
		description: 'Model used for the assistant and SQL generation',
		focusId: 'ai-provider-model',
		keywords: ['llm', 'gpt', 'claude', 'llama', 'custom model']
	},
	{
		sectionId: 'ai-provider',
		title: 'Ollama endpoint',
		description: 'Address of the local Ollama server',
		focusId: 'ai-provider-endpoint',
		keywords: ['url', 'host', 'port', 'local', '11434']
	},
	{
		sectionId: 'ai-provider',
		title: 'API key status',
		description: 'Whether a key is stored for this provider',
		focusId: 'ai-provider-key',
		keywords: ['token', 'secret']
	},
	{
		sectionId: 'ai-provider',
		title: 'Test connection',
		description: 'Check that the provider responds',
		focusId: 'ai-provider-test',
		keywords: ['ping', 'latency']
	},
	{
		sectionId: 'agent-access',
		title: 'Enable agent access',
		description: 'Let coding agents use granted connections through MCP',
		focusId: 'agent-access-enabled',
		keywords: ['mcp', 'agent', 'claude', 'cursor', 'codex']
	},
	{
		sectionId: 'agent-access',
		title: 'Connection permissions',
		description: 'Choose what agents can do per connection',
		focusId: 'agent-access-connections',
		keywords: ['read', 'write', 'propose', 'grant']
	},
	{
		sectionId: 'safety',
		title: 'Confirm before delete',
		description: 'Show confirmation for destructive actions',
		focusId: 'safety-confirm-before-delete',
		keywords: ['delete', 'destructive', 'danger']
	},
	{
		sectionId: 'safety',
		title: 'Privacy mode',
		description: 'Hide all cell values in tables and query results',
		focusId: 'safety-privacy-mask',
		keywords: ['privacy', 'mask', 'hide', 'redact', 'blur', 'sensitive', 'screenshot']
	},
	{
		sectionId: 'safety',
		title: 'Remember table contents',
		description: 'Cache the last viewed page of each table on this device',
		focusId: 'safety-persist-snapshots',
		keywords: ['cache', 'snapshot', 'restart', 'privacy']
	},
	{
		sectionId: 'safety',
		title: 'Hide AI',
		description: 'Remove every AI entry point from the app',
		focusId: 'safety-hide-ai',
		keywords: ['ai', 'assistant', 'disable ai']
	},
	{
		sectionId: 'startup',
		title: 'Connection behavior',
		description: 'Auto-connect to the last database or start empty',
		focusId: 'startup-connection-behavior',
		keywords: ['startup', 'launch', 'restore', 'database']
	},
	{
		sectionId: 'startup',
		title: 'Restore tabs on launch',
		description: 'Reopen tabs from the last session',
		focusId: 'startup-restore-tabs',
		keywords: ['tabs', 'session', 'launch']
	},
	{
		sectionId: 'interface',
		title: 'Selection bar',
		description: 'Choose the style of the row selection bar',
		focusId: 'interface-selection-bar',
		keywords: ['rows', 'selection', 'layout', 'floating']
	},
	{
		sectionId: 'interface',
		title: 'Window controls',
		description: 'Custom buttons or macOS-style traffic lights',
		focusId: 'interface-window-controls',
		keywords: ['titlebar', 'traffic lights', 'macos', 'buttons']
	},
	{
		sectionId: 'interface',
		title: 'Show toasts',
		description: 'Enable or disable toast notifications',
		focusId: 'interface-show-toasts',
		keywords: ['notifications', 'toast', 'alerts']
	},
	{
		sectionId: 'build-cache',
		title: 'Clean build artifacts',
		description: 'Inspect and clean Cargo target artifacts',
		focusId: 'build-cache-clean',
		keywords: ['cargo', 'target', 'bundle', 'cache', 'clean', 'size']
	}
]

function shortcutCategory(name: ShortcutName) {
	return Object.entries(SHORTCUT_CATEGORIES).find(([, names]) => names.includes(name))?.[0]
}

function shortcutResults(
	shortcuts: Record<ShortcutName, ShortcutDefinition>
): SettingsSearchResult[] {
	return Object.entries(shortcuts).map(([name, definition]) => {
		const shortcutName = name as ShortcutName
		const category = shortcutCategory(shortcutName)
		const combos = Array.isArray(definition.combo)
			? definition.combo.join(' ')
			: definition.combo
		return {
			id: `shortcut-${name}`,
			sectionId: 'shortcuts',
			title: definition.description,
			description: [formatShortcutList(definition.combo), definition.scope, category]
				.filter(Boolean)
				.join(' · '),
			kind: 'shortcut',
			focusId: `shortcut-${name}`,
			shortcutName,
			keywords: [name, combos, definition.scope ?? '', category ?? '']
		}
	})
}

function sectionResults(): SettingsSearchResult[] {
	return Object.values(SETTINGS_SECTIONS).map((section) => ({
		id: `section-${section.id}`,
		sectionId: section.id,
		title: section.title,
		description: section.description,
		kind: 'section',
		focusId: `section-${section.id}`,
		keywords: section.keywords
	}))
}

function settingResults(): SettingsSearchResult[] {
	return SETTING_ENTRIES.map((entry) => ({
		...entry,
		id: `setting-${entry.focusId}`,
		kind: 'setting'
	}))
}

function searchText(result: SettingsSearchResult) {
	const sectionTitle = SETTINGS_SECTIONS[result.sectionId].title
	return [result.title, result.description, sectionTitle, ...result.keywords]
		.join(' ')
		.toLowerCase()
}

/**
 * @name searchSettings
 * @description Returns every section, setting and shortcut whose title, description,
 * section name or keywords contain the query. An empty query returns no results.
 *
 * @example
 * const hits = searchSettings('vim', APP_SHORTCUTS)
 * hits[0].focusId // 'editor-vim-keybindings'
 */
export function searchSettings(
	query: string,
	shortcuts: Record<ShortcutName, ShortcutDefinition> = APP_SHORTCUTS
): SettingsSearchResult[] {
	const needle = query.trim().toLowerCase()
	if (!needle) return []
	return [...settingResults(), ...shortcutResults(shortcuts), ...sectionResults()].filter(
		(result) => searchText(result).includes(needle)
	)
}

export type SettingsSearchFilter = {
	sections: ReadonlySet<SettingsSectionId>
	rows: ReadonlyMap<SettingsSectionId, ReadonlySet<string>>
	total: number
}

/**
 * @name buildSearchFilter
 * @description Groups search results per section for in-place filtering. A section with
 * matching settings or shortcuts shows only those rows; a section that only matched on its
 * own title or keywords has no row entry and shows everything.
 *
 * @example
 * const filter = buildSearchFilter(searchSettings('vim'))
 * filter.rows.get('editor') // Set { 'editor-vim-keybindings' }
 */
export function buildSearchFilter(results: SettingsSearchResult[]): SettingsSearchFilter {
	const sections = new Set<SettingsSectionId>()
	const rows = new Map<SettingsSectionId, Set<string>>()
	for (const result of results) {
		sections.add(result.sectionId)
		if (result.kind === 'section') continue
		const focusIds = rows.get(result.sectionId) ?? new Set<string>()
		focusIds.add(result.focusId)
		rows.set(result.sectionId, focusIds)
	}
	let total = 0
	for (const id of sections) total += rows.get(id)?.size ?? 1
	return { sections, rows, total }
}

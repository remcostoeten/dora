import type { ReactNode } from 'react'
import { fuzzyMatchScore } from './fuzzy-match'

export type CommandPaletteItem = {
	id: string
	title: string
	subtitle?: string
	group: string
	keywords?: string[]
	hint?: string
	icon?: ReactNode
	emoji?: string
	shortcut?: string
	alwaysShow?: boolean
	searchOnly?: boolean
	disabled?: boolean
	onSelect: () => void | Promise<void>
}

export type CommandPaletteGroup = {
	group: string
	items: CommandPaletteItem[]
}

const DEFAULT_GROUP = 'Actions'
const RECENT_GROUP = 'Recent'
const MAX_RECENT_ITEMS = 5
const GROUP_ORDER = [
	RECENT_GROUP,
	DEFAULT_GROUP,
	'Connections',
	'Tables',
	'Snippets',
	'Queries',
	'History',
	'Navigation',
	'Docker',
	'Settings',
	'Editor',
	'Help'
]

export const COMMAND_BANGS: Record<string, { label: string; groups: string[] }> = {
	a: { label: 'Actions', groups: [DEFAULT_GROUP, 'Navigation', 'Editor', 'Help'] },
	c: { label: 'Connections', groups: ['Connections'] },
	t: { label: 'Tables', groups: ['Tables'] },
	s: { label: 'Snippets', groups: ['Snippets', 'Queries'] },
	h: { label: 'History', groups: ['History'] },
	d: { label: 'Docker', groups: ['Docker'] }
}

export type ParsedCommandQuery = {
	bang: string | null
	allowedGroups: Set<string> | null
	query: string
}

export function parseCommandQuery(raw: string): ParsedCommandQuery {
	const match = raw.match(/^!([a-z])(?:\s+(.*))?$/i)
	if (match) {
		const key = match[1].toLowerCase()
		const bang = COMMAND_BANGS[key]
		if (bang) {
			return {
				bang: key,
				allowedGroups: new Set(bang.groups),
				query: (match[2] ?? '').trim()
			}
		}
	}

	return { bang: null, allowedGroups: null, query: raw.trim() }
}

function getItemGroup(item: CommandPaletteItem) {
	return item.group?.trim() || DEFAULT_GROUP
}

function getItemMatchScore(item: CommandPaletteItem, query: string): number | null {
	const labelScore = fuzzyMatchScore(query, item.title)
	let best = labelScore === null ? null : labelScore * 2

	const secondaryFields = [
		item.subtitle,
		item.hint,
		item.shortcut,
		getItemGroup(item),
		...(item.keywords ?? [])
	]

	for (const field of secondaryFields) {
		if (!field) continue
		const score = fuzzyMatchScore(query, field)
		if (score !== null && (best === null || score > best)) {
			best = score
		}
	}

	return best
}

function compareGroups(a: string, b: string) {
	const aIndex = GROUP_ORDER.indexOf(a)
	const bIndex = GROUP_ORDER.indexOf(b)
	if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex
	if (aIndex >= 0) return -1
	if (bIndex >= 0) return 1
	return a.localeCompare(b)
}

function buildRecentItems(
	items: CommandPaletteItem[],
	frecency: Record<string, number>
): CommandPaletteItem[] {
	return items
		.filter((item) => (frecency[item.id] ?? 0) > 0)
		.sort((a, b) => (frecency[b.id] ?? 0) - (frecency[a.id] ?? 0))
		.slice(0, MAX_RECENT_ITEMS)
}

export function getCommandPaletteGroups(
	items: CommandPaletteItem[],
	query: string,
	frecency: Record<string, number> = {}
): CommandPaletteGroup[] {
	const { allowedGroups, query: searchQuery } = parseCommandQuery(query)
	const normalizedQuery = searchQuery.toLowerCase()
	const bangActive = allowedGroups !== null
	const grouped = new Map<string, CommandPaletteItem[]>()
	const matchScores = new Map<string, number>()

	if (!normalizedQuery && (!allowedGroups || allowedGroups.has(RECENT_GROUP))) {
		const recentItems = buildRecentItems(items, frecency)
		if (recentItems.length > 0) {
			grouped.set(RECENT_GROUP, recentItems)
		}
	}

	for (const item of items) {
		const group = getItemGroup(item)

		if (allowedGroups && !allowedGroups.has(group)) {
			continue
		}

		if (item.searchOnly && !normalizedQuery && !bangActive) {
			continue
		}

		if (normalizedQuery) {
			const score = getItemMatchScore(item, normalizedQuery)
			if (score === null && !(item.alwaysShow ?? false)) {
				continue
			}
			matchScores.set(item.id, (score ?? 0) + Math.min(frecency[item.id] ?? 0, 10))
		}

		const groupItems = grouped.get(group) ?? []
		groupItems.push(item)
		grouped.set(group, groupItems)
	}

	if (normalizedQuery) {
		for (const groupItems of grouped.values()) {
			groupItems.sort((a, b) => (matchScores.get(b.id) ?? 0) - (matchScores.get(a.id) ?? 0))
		}
	}

	return [...grouped.entries()]
		.sort(([a], [b]) => compareGroups(a, b))
		.map(([group, groupItems]) => ({ group, items: groupItems }))
}

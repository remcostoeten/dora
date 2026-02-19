'use client'

import { useShortcut as useShortcutBase, UseShortcutOptions } from '@/shared/lib/use-shortcut'

export type ShortcutDefinition = {
	combo: string | string[]
	description: string
	scope?: 'global' | 'data-grid' | 'sql-console' | 'editor'
}

export const APP_SHORTCUTS = {
	selectAll: {
		combo: 'mod+a',
		description: 'Select all rows',
		scope: 'data-grid'
	},
	deselect: {
		combo: ['escape', 'mod+d', 'd'],
		description: 'Deselect all',
		scope: 'data-grid'
	},
	deleteRows: {
		combo: ['delete', 'shift+backspace'],
		description: 'Delete selected rows',
		scope: 'data-grid'
	},
	focusToolbar: {
		combo: 'alt+t',
		description: 'Focus toolbar',
		scope: 'data-grid'
	},
	runQuery: {
		combo: 'mod+enter',
		description: 'Run query',
		scope: 'sql-console'
	},
	save: {
		combo: 'mod+s',
		description: 'Save',
		scope: 'global'
	},
	find: {
		combo: 'mod+f',
		description: 'Find',
		scope: 'editor'
	},
	replace: {
		combo: 'mod+h',
		description: 'Replace',
		scope: 'editor'
	},
	toggleComment: {
		combo: 'mod+slash',
		description: 'Toggle comment',
		scope: 'editor'
	},
	selectNextOccurrence: {
		combo: 'mod+d',
		description: 'Select next occurrence',
		scope: 'editor'
	},
	moveLineUp: {
		combo: 'alt+up',
		description: 'Move line up',
		scope: 'editor'
	},
	moveLineDown: {
		combo: 'alt+down',
		description: 'Move line down',
		scope: 'editor'
	},
	deleteLine: {
		combo: 'mod+shift+k',
		description: 'Delete line',
		scope: 'editor'
	}
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutName = keyof typeof APP_SHORTCUTS

export function getShortcutsByScope(
	scope: ShortcutDefinition['scope']
): Array<{ name: ShortcutName; definition: ShortcutDefinition }> {
	return Object.entries(APP_SHORTCUTS)
		.filter(function ([, def]) {
			return def.scope === scope || def.scope === 'global'
		})
		.map(function ([name, definition]) {
			return { name: name as ShortcutName, definition }
		})
}

export function getAllShortcuts(): Array<{ name: ShortcutName; definition: ShortcutDefinition }> {
	return Object.entries(APP_SHORTCUTS).map(function ([name, definition]) {
		return { name: name as ShortcutName, definition }
	})
}

export function useShortcut(options?: UseShortcutOptions) {
	return useShortcutBase(options)
}

export { formatShortcut, getModifierSymbols } from '@/shared/lib/use-shortcut'

'use client'

import { useEffect } from 'react'
import {
	registerShortcutMap,
	useShortcut as useShortcutBase,
	type ActionKey,
	type ExceptPredicate,
	type ExceptPreset,
	type HandlerOptions,
	type ShortcutBuilder as PackageShortcutBuilder,
	type ShortcutConflict,
	type ShortcutDebugEvent,
	type ShortcutDebugOptions,
	type ShortcutGroup,
	type ShortcutHandler,
	type ShortcutMap,
	type ShortcutMapEntry,
	type ShortcutMapResult,
	type ShortcutRecordingOptions,
	type ShortcutResult,
	type ShortcutScope,
	type UseShortcutOptions
} from '@remcostoeten/use-shortcut/react'
import {
	formatShortcut,
	getModifierSymbols
} from '@remcostoeten/use-shortcut/formatter'

export type ShortcutDefinition = {
	combo: string | string[]
	description: string
	scope?: 'global' | 'data-grid' | 'sql-console' | 'editor'
}

export const APP_SHORTCUTS = {
	// ── Global ──────────────────────────────────────────────────────────────
	openCommandPalette: {
		combo: 'mod+k',
		description: 'Open command palette',
		scope: 'global'
	},
	save: {
		combo: 'mod+s',
		description: 'Save',
		scope: 'global'
	},
	newConnection: {
		combo: 'mod+shift+n',
		description: 'Add connection',
		scope: 'global'
	},
	toggleSidebar: {
		combo: 'mod+b',
		description: 'Toggle sidebar',
		scope: 'global'
	},
	openSettings: {
		combo: 'mod+comma',
		description: 'Open settings',
		scope: 'global'
	},
	closeTab: {
		combo: 'mod+w',
		description: 'Close current tab',
		scope: 'global'
	},
	reconnect: {
		combo: 'mod+shift+r',
		description: 'Reconnect to database',
		scope: 'global'
	},
	switchConnection1: { combo: 'mod+1', description: 'Switch to connection 1', scope: 'global' },
	switchConnection2: { combo: 'mod+2', description: 'Switch to connection 2', scope: 'global' },
	switchConnection3: { combo: 'mod+3', description: 'Switch to connection 3', scope: 'global' },
	switchConnection4: { combo: 'mod+4', description: 'Switch to connection 4', scope: 'global' },
	switchConnection5: { combo: 'mod+5', description: 'Switch to connection 5', scope: 'global' },
	switchConnection6: { combo: 'mod+6', description: 'Switch to connection 6', scope: 'global' },
	switchConnection7: { combo: 'mod+7', description: 'Switch to connection 7', scope: 'global' },
	switchConnection8: { combo: 'mod+8', description: 'Switch to connection 8', scope: 'global' },
	switchConnection9: { combo: 'mod+9', description: 'Switch to connection 9', scope: 'global' },

	// ── Go-To chords (G → key) ───────────────────────────────────────────────
	gotoDashboard:   { combo: 'g d', description: 'Go to dashboard',   scope: 'global' },
	gotoSettings:    { combo: 'g s', description: 'Go to settings',    scope: 'global' },
	gotoConnections: { combo: 'g c', description: 'Go to connections', scope: 'global' },
	gotoEditor:      { combo: 'g e', description: 'Go to SQL editor',  scope: 'global' },
	gotoDocker:      { combo: 'g k', description: 'Go to Docker',      scope: 'global' },

	// ── SQL Console ──────────────────────────────────────────────────────────
	runQuery: {
		combo: 'mod+enter',
		description: 'Run query',
		scope: 'sql-console'
	},
	runSelection: {
		combo: 'mod+shift+enter',
		description: 'Run selected SQL',
		scope: 'sql-console'
	},
	formatQuery: {
		combo: 'mod+shift+f',
		description: 'Format SQL',
		scope: 'sql-console'
	},
	openQueryHistory: {
		combo: 'mod+shift+h',
		description: 'Open query history',
		scope: 'sql-console'
	},
	saveScript: {
		combo: 'mod+s',
		description: 'Save script',
		scope: 'sql-console'
	},
	newTab: {
		combo: 'mod+t',
		description: 'New query tab',
		scope: 'sql-console'
	},

	// ── Editor ───────────────────────────────────────────────────────────────
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
	},
	goToLine: {
		combo: 'mod+g',
		description: 'Go to line',
		scope: 'editor'
	},

	// ── Database Studio / Data Grid ──────────────────────────────────────────
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
	refreshTable: {
		combo: ['mod+r', 'f5'],
		description: 'Refresh table',
		scope: 'data-grid'
	},
	filterRows: {
		combo: 'mod+shift+f',
		description: 'Filter rows',
		scope: 'data-grid'
	},
	insertRow: {
		combo: 'mod+shift+i',
		description: 'Insert row',
		scope: 'data-grid'
	},
	exportTable: {
		combo: 'mod+e',
		description: 'Export table',
		scope: 'data-grid'
	},
	startLiveMonitor: {
		combo: 'mod+shift+m',
		description: 'Start live monitor',
		scope: 'data-grid'
	},
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutName = keyof typeof APP_SHORTCUTS

export const SHORTCUT_CATEGORIES: Record<string, ShortcutName[]> = {
	'Navigation': [
		'openCommandPalette', 'newConnection', 'toggleSidebar', 'openSettings',
		'closeTab', 'reconnect',
		'switchConnection1', 'switchConnection2', 'switchConnection3',
		'switchConnection4', 'switchConnection5', 'switchConnection6',
		'switchConnection7', 'switchConnection8', 'switchConnection9',
	],
	'Go To (G → key)': [
		'gotoDashboard', 'gotoSettings', 'gotoConnections', 'gotoEditor', 'gotoDocker',
	],
	'SQL Console': [
		'runQuery', 'runSelection', 'formatQuery', 'saveScript', 'openQueryHistory', 'newTab',
	],
	'Editor': [
		'find', 'replace', 'toggleComment', 'selectNextOccurrence',
		'moveLineUp', 'moveLineDown', 'deleteLine', 'goToLine',
	],
	'Database Studio': [
		'selectAll', 'deselect', 'deleteRows', 'focusToolbar',
		'refreshTable', 'filterRows', 'insertRow', 'exportTable', 'startLiveMonitor',
	],
	'Global': ['save'],
}

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

type BoundShortcutState = {
	except?: ExceptPreset | ExceptPreset[] | ExceptPredicate
	scopes?: ShortcutScope
}

type BoundShortcutChain = {
	on: (handler: ShortcutHandler, options?: HandlerOptions) => ShortcutResult
	handle: (options: HandlerOptions & { handler: ShortcutHandler }) => ShortcutResult
	except: (condition: ExceptPreset | ExceptPreset[] | ExceptPredicate) => BoundShortcutChain
	in: (scopes: ShortcutScope) => BoundShortcutChain
}

export type ShortcutBuilder = PackageShortcutBuilder & {
	bind: (combo: string | string[]) => BoundShortcutChain
}

export type {
	ActionKey,
	ExceptPredicate,
	ExceptPreset,
	HandlerOptions,
	ShortcutConflict,
	ShortcutDebugEvent,
	ShortcutDebugOptions,
	ShortcutGroup,
	ShortcutHandler,
	ShortcutMap,
	ShortcutMapEntry,
	ShortcutMapResult,
	ShortcutRecordingOptions,
	ShortcutResult,
	ShortcutScope,
	UseShortcutOptions
}

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function toScopeList(scopes?: ShortcutScope): string[] {
	if (!scopes) return []
	return Array.isArray(scopes) ? scopes : [scopes]
}

function mergeScopes(a?: ShortcutScope, b?: ShortcutScope): ShortcutScope | undefined {
	const mergedScopes = [...toScopeList(a), ...toScopeList(b)].filter(Boolean)
	if (mergedScopes.length === 0) return undefined
	if (mergedScopes.length === 1) return mergedScopes[0]
	return Array.from(new Set(mergedScopes))
}

function evaluateExceptCondition(
	event: KeyboardEvent,
	condition: ExceptPreset | ExceptPreset[] | ExceptPredicate
): boolean {
	if (typeof condition === 'function') {
		return condition(event)
	}

	if (Array.isArray(condition)) {
		return condition.some(function (entry) {
			return evaluateExceptCondition(event, entry)
		})
	}

	const target = event.target as HTMLElement | null

	switch (condition) {
		case 'input':
			return target ? IGNORED_TAGS.has(target.tagName) : false
		case 'editable':
			return target?.isContentEditable ?? false
		case 'typing':
			if (!target || !target.tagName) return false

			return (
				IGNORED_TAGS.has(target.tagName) ||
				target.isContentEditable ||
				target.classList?.contains('inputarea') ||
				target.getAttribute?.('role') === 'textbox'
			)
		case 'modal':
			return document.querySelector('[data-modal="true"], [role="dialog"]') !== null
		case 'disabled':
			return target
				? target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true'
				: false
		default:
			return false
	}
}

function mergeExceptConditions(
	a?: ExceptPreset | ExceptPreset[] | ExceptPredicate,
	b?: ExceptPreset | ExceptPreset[] | ExceptPredicate
): ExceptPreset | ExceptPreset[] | ExceptPredicate | undefined {
	if (!a) return b
	if (!b) return a

	const aIsFunction = typeof a === 'function'
	const bIsFunction = typeof b === 'function'

	if (!aIsFunction && !bIsFunction) {
		const merged = [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])]
		return Array.from(new Set(merged))
	}

	return function mergedExcept(event: KeyboardEvent) {
		return evaluateExceptCondition(event, a) || evaluateExceptCondition(event, b)
	}
}

function registerBoundShortcut(
	builder: PackageShortcutBuilder,
	combo: string | string[],
	state: BoundShortcutState,
	handler: ShortcutHandler,
	options?: HandlerOptions
): ShortcutResult {
	const mergedOptions: HandlerOptions = {
		...options,
		except: mergeExceptConditions(state.except, options?.except),
		scopes: mergeScopes(state.scopes, options?.scopes)
	}

	return registerShortcutMap(builder, {
		boundShortcut: {
			keys: combo,
			handler,
			options: mergedOptions
		}
	}).boundShortcut
}

function createBoundShortcutChain(
	builder: PackageShortcutBuilder,
	combo: string | string[],
	state: BoundShortcutState = {}
): BoundShortcutChain {
	return {
		on: function (handler, options) {
			return registerBoundShortcut(builder, combo, state, handler, options)
		},
		handle: function (options) {
			const { handler, ...handlerOptions } = options
			return registerBoundShortcut(builder, combo, state, handler, handlerOptions)
		},
		except: function (condition) {
			return createBoundShortcutChain(builder, combo, {
				...state,
				except: mergeExceptConditions(state.except, condition)
			})
		},
		in: function (scopes) {
			return createBoundShortcutChain(builder, combo, {
				...state,
				scopes: mergeScopes(state.scopes, scopes)
			})
		}
	}
}

export function useActiveScope(
	$: ShortcutBuilder,
	scope: ShortcutDefinition['scope']
) {
	useEffect(() => {
		if (!scope || scope === 'global') return
		$.enableScope(scope)
		return () => $.disableScope(scope)
	}, [scope])
}

export function useShortcut(options?: UseShortcutOptions): ShortcutBuilder {
	const builder = useShortcutBase(options)

	return new Proxy(builder, {
		get(target, prop, receiver) {
			if (prop === 'bind') {
				return function bind(combo: string | string[]) {
					return createBoundShortcutChain(builder, combo)
				}
			}

			return Reflect.get(target as object, prop, receiver)
		}
	}) as ShortcutBuilder
}

export { formatShortcut, getModifierSymbols }
export {
	createShortcutGroup,
	registerShortcutMap,
	useShortcutGroup,
	useShortcutMap
} from '@remcostoeten/use-shortcut/react'
export {
	matchesAnyShortcut,
	matchesShortcut,
	parseShortcut,
	parseShortcuts
} from '@remcostoeten/use-shortcut/parser'
export { detectPlatform } from '@remcostoeten/use-shortcut/constants'

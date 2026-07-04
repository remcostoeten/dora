'use client'

import { useEffect, useRef } from 'react'
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
	toggleAiAssistant: {
		combo: 'mod+shift+b',
		description: 'Toggle AI assistant',
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
	prevConnection: { combo: 'ctrl+shift+bracketleft', description: 'Previous open connection', scope: 'global' },
	nextConnection: { combo: 'ctrl+shift+bracketright', description: 'Next open connection', scope: 'global' },
	quitApp: {
		combo: 'ctrl+q',
		description: 'Quit application',
		scope: 'global'
	},

	// ── View ─────────────────────────────────────────────────────────────────
	zoomIn: {
		combo: ['mod+equal', 'mod+plus'],
		description: 'Zoom in',
		scope: 'global'
	},
	zoomOut: {
		combo: 'mod+minus',
		description: 'Zoom out',
		scope: 'global'
	},
	zoomReset: {
		combo: 'mod+0',
		description: 'Reset zoom',
		scope: 'global'
	},
	toggleFullscreen: {
		combo: ['ctrl+enter', 'f11'],
		description: 'Toggle fullscreen',
		scope: 'global'
	},

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
	aiCmdK: {
		combo: 'mod+i',
		description: 'AI: generate SQL from prompt',
		scope: 'sql-console'
	},
	switchToSql: {
		combo: 'alt+s',
		description: 'Switch to SQL mode',
		scope: 'sql-console'
	},
	switchToDrizzle: {
		combo: 'alt+d',
		description: 'Switch to Drizzle mode',
		scope: 'sql-console'
	},
	switchToPrisma: {
		combo: 'alt+p',
		description: 'Switch to Prisma mode',
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
		combo: ['escape', 'mod+d'],
		description: 'Deselect all',
		scope: 'data-grid'
	},
	editCell: {
		combo: ['e', 'f2', 'enter'],
		description: 'Edit focused cell',
		scope: 'data-grid'
	},
	deleteRows: {
		combo: ['delete', 'shift+backspace', 'd'],
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
		'openCommandPalette', 'newConnection', 'toggleSidebar', 'toggleAiAssistant', 'openSettings',
		'closeTab', 'reconnect', 'quitApp',
		'switchConnection1', 'switchConnection2', 'switchConnection3',
		'switchConnection4', 'switchConnection5', 'switchConnection6',
		'switchConnection7', 'switchConnection8', 'switchConnection9',
		'prevConnection', 'nextConnection',
	],
	'Go To (G → key)': [
		'gotoDashboard', 'gotoSettings', 'gotoConnections', 'gotoEditor', 'gotoDocker',
	],
	'View': [
		'zoomIn', 'zoomOut', 'zoomReset', 'toggleFullscreen',
	],
	'SQL Console': [
		'runQuery', 'runSelection', 'formatQuery', 'saveScript', 'openQueryHistory', 'newTab', 'aiCmdK',
		'switchToSql', 'switchToDrizzle', 'switchToPrisma',
	],
	'Editor': [
		'find', 'replace', 'toggleComment', 'selectNextOccurrence',
		'moveLineUp', 'moveLineDown', 'deleteLine', 'goToLine',
	],
	'Database Studio': [
		'selectAll', 'deselect', 'editCell', 'deleteRows', 'focusToolbar',
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

export type ShortcutConflictResult = {
	name: ShortcutName
	definition: ShortcutDefinition
	combo: string
}

const MODIFIER_ORDER = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const
const MODIFIER_ALIASES: Record<string, string> = {
	cmd: 'mod',
	command: 'mod',
	control: 'ctrl',
	option: 'alt',
	esc: 'escape',
	del: 'delete',
	return: 'enter',
	arrowup: 'up',
	arrowdown: 'down',
	arrowleft: 'left',
	arrowright: 'right',
	' ': 'space'
}

export function toShortcutList(combo: string | string[]): string[] {
	return (Array.isArray(combo) ? combo : [combo])
		.map(function (entry) {
			return entry.trim()
		})
		.filter(Boolean)
}

function normalizeShortcutStep(step: string): string {
	const parts = step
		.split('+')
		.map(function (part) {
			const normalized = part.trim().toLowerCase()
			return MODIFIER_ALIASES[normalized] ?? normalized
		})
		.filter(Boolean)

	const modifiers = MODIFIER_ORDER.filter(function (modifier) {
		return parts.includes(modifier)
	})
	const key = parts.find(function (part) {
		return !MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number])
	})

	return [...modifiers, key].filter(Boolean).join('+')
}

export function normalizeShortcut(combo: string): string {
	return combo
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map(normalizeShortcutStep)
		.filter(Boolean)
		.join(' ')
}

export function formatShortcutList(combo: string | string[]): string {
	return toShortcutList(combo)
		.map(function (entry) {
			return formatShortcut(entry)
		})
		.join(' / ')
}

function shortcutScopesConflict(
	a?: ShortcutDefinition['scope'],
	b?: ShortcutDefinition['scope']
): boolean {
	if (!a || !b) return true
	if (a === 'global' || b === 'global') return true
	return a === b
}

export function findShortcutConflict(
	name: ShortcutName,
	combo: string | string[],
	shortcuts: Record<ShortcutName, ShortcutDefinition>
): ShortcutConflictResult | null {
	const current = shortcuts[name]
	if (!current) return null

	const candidates = new Set(
		toShortcutList(combo).map(function (entry) {
			return normalizeShortcut(entry)
		})
	)

	if (candidates.size === 0) return null

	for (const [otherName, definition] of Object.entries(shortcuts)) {
		if (otherName === name) continue
		if (!shortcutScopesConflict(current.scope, definition.scope)) continue

		for (const otherCombo of toShortcutList(definition.combo)) {
			const normalized = normalizeShortcut(otherCombo)
			if (candidates.has(normalized)) {
				return {
					name: otherName as ShortcutName,
					definition,
					combo: otherCombo
				}
			}
		}
	}

	return null
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

// Wraps a BoundShortcutChain so that calling .on() / .handle() first unbinds any
// previous registration for the same combo key, preventing handler accumulation
// across re-renders when shortcuts are registered in the component body.
function createDedupChain(
	chain: BoundShortcutChain,
	comboKey: string,
	registrations: Map<string, () => void>
): BoundShortcutChain {
	return {
		on: function (handler, options) {
			registrations.get(comboKey)?.()
			const result = chain.on(handler, options)
			registrations.set(comboKey, result.unbind)
			return result
		},
		handle: function (options) {
			registrations.get(comboKey)?.()
			const result = chain.handle(options)
			registrations.set(comboKey, result.unbind)
			return result
		},
		except: function (condition) {
			return createDedupChain(chain.except(condition), comboKey, registrations)
		},
		in: function (scopes) {
			return createDedupChain(chain.in(scopes), comboKey, registrations)
		}
	}
}

export function useShortcut(options?: UseShortcutOptions): ShortcutBuilder {
	const builder = useShortcutBase(options)
	const registrationsRef = useRef<Map<string, () => void>>(new Map())

	useEffect(() => {
		const map = registrationsRef.current
		return () => {
			map.forEach(function (unbind) { unbind() })
			map.clear()
		}
	}, [])

	return new Proxy(builder, {
		get(target, prop, receiver) {
			if (prop === 'bind') {
				return function bind(combo: string | string[]) {
					const comboKey = Array.isArray(combo) ? combo.join('\0') : combo
					return createDedupChain(
						createBoundShortcutChain(builder, combo),
						comboKey,
						registrationsRef.current
					)
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

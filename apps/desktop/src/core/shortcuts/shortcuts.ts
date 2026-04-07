'use client'

import { useMemo } from 'react'
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
	openCommandPalette: {
		combo: 'mod+k',
		description: 'Open command palette',
		scope: 'global'
	},
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
	bindShortcut: (combo: string | string[]) => BoundShortcutChain
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

export function useShortcut(options?: UseShortcutOptions): ShortcutBuilder {
	const builder = useShortcutBase(options)

	return useMemo(function () {
		return new Proxy(builder as object, {
			get(target, prop, receiver) {
				if (prop === 'bindShortcut') {
					return function bindShortcut(combo: string | string[]) {
						return createBoundShortcutChain(builder, combo)
					}
				}

				return Reflect.get(target, prop, receiver)
			}
		}) as ShortcutBuilder
	}, [builder])
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

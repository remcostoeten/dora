import { detectPlatform, Platform, ModifierDisplaySymbols, ModifierKey, ModifierDisplayOrder } from "./constants";
import type { ModifierKeyType } from "./constants";
import { parseShortcut, matchesShortcut } from "./parser";
import type { ActionKey, ModifierFlags, ShortcutHandler, HandlerOptions, ShortcutResult, UseShortcutOptions, ExceptPreset, ExceptPredicate, ShortcutBuilder as IShortcutBuilder } from "./types";

const MODIFIER_KEYS = new Set(['ctrl', 'shift', 'alt', 'cmd', 'mod'])
const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

const EXCEPT_PREDICATES: Record<ExceptPreset, ExceptPredicate> = {
	input: (e) => {
		const target = e.target as HTMLElement
		return IGNORED_TAGS.has(target.tagName)
	},
	editable: (e) => {
		const target = e.target as HTMLElement
		return target.isContentEditable
	},
	typing: (e) => {
		const target = e.target as HTMLElement
		if (!target || !target.tagName) return false

		return (
			IGNORED_TAGS.has(target.tagName) ||
			target.isContentEditable ||
			target.classList?.contains('inputarea') || // Monaco editor
			target.getAttribute?.('role') === 'textbox'
		)
	},
	modal: () => {
		return document.querySelector('[data-modal="true"], [role="dialog"]') !== null
	},
	disabled: (e) => {
		const target = e.target as HTMLElement
		return target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true'
	}
}

function shouldExcept(
	event: KeyboardEvent,
	except?: ExceptPreset | ExceptPreset[] | ExceptPredicate
): boolean {
	if (!except) return false

	if (typeof except === 'function') {
		return except(event)
	}

	if (Array.isArray(except)) {
		return except.some((preset) => EXCEPT_PREDICATES[preset]?.(event))
	}

	return EXCEPT_PREDICATES[except]?.(event) ?? false
}

type BuilderState = {
	modifiers: Partial<ModifierFlags>
	key: ActionKey | null
	options: UseShortcutOptions
	except?: ExceptPreset | ExceptPreset[] | ExceptPredicate
}

type ShortcutRegistry = {
	listeners: Map<
		string,
		{
			handler: (e: KeyboardEvent) => void
			unbind: () => void
			isEnabled: boolean
			attemptCallbacks: Set<(matched: boolean, event: KeyboardEvent) => void>
		}
	>
	options: UseShortcutOptions
}

function getActiveModifierTokens(modifiers: Partial<ModifierFlags>): string[] {
	const platform = detectPlatform()
	const order = ModifierDisplayOrder[platform]

	return order
		.filter((key) => {
			if (key === ModifierKey.CTRL) return modifiers.ctrl
			if (key === ModifierKey.ALT) return modifiers.alt
			if (key === ModifierKey.SHIFT) return modifiers.shift
			if (key === ModifierKey.META) return modifiers.cmd
			return false
		})
		.map((key) => {
			if (key === ModifierKey.CTRL) return 'ctrl'
			if (key === ModifierKey.ALT) return 'alt'
			if (key === ModifierKey.SHIFT) return 'shift'
			if (key === ModifierKey.META) return 'cmd'
			return ''
		})
}

function buildComboString(modifiers: Partial<ModifierFlags>, key: ActionKey): string {
	const tokens = getActiveModifierTokens(modifiers)
	return [...tokens, key].join('+')
}

function formatCombo(modifiers: Partial<ModifierFlags>, key: ActionKey): string {
	const platform = detectPlatform()
	const symbols = ModifierDisplaySymbols[platform]
	const tokens = getActiveModifierTokens(modifiers)

	const parts = tokens.map((t) => {
		if (t === 'ctrl') return symbols[ModifierKey.CTRL]
		if (t === 'alt') return symbols[ModifierKey.ALT]
		if (t === 'shift') return symbols[ModifierKey.SHIFT]
		if (t === 'cmd') return symbols[ModifierKey.META]
		return t
	})

	parts.push(key.length === 1 ? key.toUpperCase() : key)

	return platform === Platform.MAC ? parts.join('') : parts.join('+')
}

function debugLog(debug: boolean | undefined, ...args: unknown[]) {
	if (debug) {
		console.log('[useShortcut]', ...args)
	}
}

function createBinding(
	state: BuilderState,
	handler: ShortcutHandler,
	handlerOptions: HandlerOptions = {},
	registry: ShortcutRegistry
): ShortcutResult {
	const { modifiers, key, options, except: stateExcept } = state

	if (!key) {
		throw new Error('[useShortcut] No key specified. Use .key() to set the action key.')
	}

	const combo = buildComboString(modifiers, key)
	const display = formatCombo(modifiers, key)
	const parsed = parseShortcut(combo)
	const debug = options.debug ?? false
	const except = stateExcept ?? handlerOptions.except

	const existing = registry.listeners.get(combo)
	if (existing) {
		debugLog(debug, 'Updating existing shortcut:', combo)
		return {
			unbind: existing.unbind,
			display,
			combo,
			trigger: () => handler(new KeyboardEvent('keydown')),
			get isEnabled() {
				return existing.isEnabled
			},
			enable: () => {
				existing.isEnabled = true
			},
			disable: () => {
				existing.isEnabled = false
			},
			onAttempt: (callback) => {
				existing.attemptCallbacks.add(callback)
				return () => existing.attemptCallbacks.delete(callback)
			}
		}
	}

	const isEnabled = !handlerOptions.disabled && !options.disabled
	const delay = handlerOptions.delay ?? options.delay ?? 0
	const attemptCallbacks = new Set<(matched: boolean, event: KeyboardEvent) => void>()

	debugLog(debug, 'Registering:', combo, '→', display, {
		modifiers,
		key,
		parsed,
		except: !!except
	})

	const currentHandler = handler

	function handleEvent(event: KeyboardEvent) {
		const entry = registry.listeners.get(combo)
		if (!entry?.isEnabled) return

		if (options.ignoreInputs !== false && !except) {
			const target = event.target as HTMLElement
			if (IGNORED_TAGS.has(target.tagName) || target.isContentEditable) {
				return
			}
		}

		if (shouldExcept(event, except)) {
			debugLog(debug, 'Skipped due to except condition:', combo)
			return
		}

		debugLog(debug, 'Key pressed:', event.key, {
			ctrl: event.ctrlKey,
			alt: event.altKey,
			shift: event.shiftKey,
			meta: event.metaKey
		})

		const matched = matchesShortcut(event, parsed)

		entry.attemptCallbacks.forEach((cb) => cb(matched, event))

		if (matched) {
			debugLog(debug, 'MATCHED:', combo, '→', display)

			if (handlerOptions.preventDefault !== false) {
				event.preventDefault()
			}

			if (handlerOptions.stopPropagation) {
				event.stopPropagation()
			}

			if (delay > 0) {
				debugLog(debug, 'Delaying execution by', delay, 'ms')
				setTimeout(() => currentHandler(event), delay)
			} else {
				currentHandler(event)
			}
		}
	}

	const target = options.target ?? (typeof window !== 'undefined' ? window : null)
	const eventType = options.eventType ?? 'keydown'

	if (target) {
		target.addEventListener(eventType, handleEvent as EventListener)
		debugLog(debug, 'Listener attached for:', combo)
	}

	function unbind() {
		if (target) {
			target.removeEventListener(eventType, handleEvent as EventListener)
			registry.listeners.delete(combo)
			debugLog(debug, 'Unregistered:', combo)
		}
	}

	registry.listeners.set(combo, {
		handler: handleEvent,
		unbind,
		isEnabled,
		attemptCallbacks
	})

	return {
		unbind,
		display,
		combo,
		trigger: () => handler(new KeyboardEvent(eventType)),
		get isEnabled() {
			return registry.listeners.get(combo)?.isEnabled ?? false
		},
		enable: () => {
			const entry = registry.listeners.get(combo)
			if (entry) entry.isEnabled = true
		},
		disable: () => {
			const entry = registry.listeners.get(combo)
			if (entry) entry.isEnabled = false
		},
		onAttempt: (callback) => {
			const entry = registry.listeners.get(combo)
			if (entry) {
				entry.attemptCallbacks.add(callback)
				return () => entry.attemptCallbacks.delete(callback)
			}
			return () => {}
		}
	}
}

export function createShortcutBuilder(options: UseShortcutOptions = {}): {
	builder: IShortcutBuilder
	registry: ShortcutRegistry
} {
	const registry: ShortcutRegistry = {
		listeners: new Map(),
		options
	}

	debugLog(options.debug, 'Builder created with options:', options)

	function createProxy(currentState: BuilderState): IShortcutBuilder {
		return new Proxy({} as IShortcutBuilder, {
			get(_, prop: string) {
				if (prop === '__debug') {
					return currentState.options.debug
				}

				if (MODIFIER_KEYS.has(prop)) {
					const platform = detectPlatform()
					const modKey =
						prop === 'mod' ? (platform === Platform.MAC ? 'cmd' : 'ctrl') : prop

					const newState: BuilderState = {
						...currentState,
						modifiers: { ...currentState.modifiers, [modKey]: true }
					}

					debugLog(currentState.options.debug, `Chain: +${prop} →`, newState.modifiers)

					return createProxy(newState)
				}

				if (prop === 'key') {
					return (key: ActionKey) => {
						const newState: BuilderState = {
							...currentState,
							key
						}

						debugLog(currentState.options.debug, `Chain: .key("${key}")`)

						return createProxy(newState)
					}
				}

				if (prop === 'except') {
					return (condition: ExceptPreset | ExceptPreset[] | ExceptPredicate) => {
						const newState: BuilderState = {
							...currentState,
							except: condition
						}

						debugLog(currentState.options.debug, `Chain: .except()`, condition)

						return createProxy(newState)
					}
				}

				if (prop === 'on') {
					return (handler: ShortcutHandler, handlerOptions?: HandlerOptions) => {
						return createBinding(currentState, handler, handlerOptions, registry)
					}
				}

				if (prop === 'handle') {
					return (opts: HandlerOptions & { handler: ShortcutHandler }) => {
						const { handler, ...rest } = opts
						return createBinding(currentState, handler, rest, registry)
					}
				}

				return undefined
			}
		})
	}

	const initialState: BuilderState = {
		modifiers: {},
		key: null,
		options
	}

	return {
		builder: createProxy(initialState),
		registry
	}
}

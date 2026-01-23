import { ModifierAliases, SpecialKeyMap, detectPlatform, Platform } from "./constants";
import type { ModifierState, ParsedShortcut } from "./types";

export function parseShortcut(shortcut: string): ParsedShortcut {
	const platform = detectPlatform()
	const normalized = shortcut.toLowerCase().trim()
	const parts = normalized.split(/[\s+-]+/).filter(Boolean)

	if (parts.length === 0) {
		throw new Error(`Invalid shortcut: "${shortcut}"`)
	}

	const modifiers: ModifierState = {
		meta: false,
		ctrl: false,
		alt: false,
		shift: false
	}

	let key = parts.pop()!

	for (const part of parts) {
		const modifierKey = ModifierAliases[part]

		if (modifierKey) {
			if (part === 'mod') {
				if (platform === Platform.MAC) {
					modifiers.meta = true
				} else {
					modifiers.ctrl = true
				}
			} else {
				modifiers[modifierKey] = true
			}
		} else {
			key = part + key
		}
	}

	const normalizedKey = SpecialKeyMap[key] || key

	return {
		modifiers,
		key: normalizedKey.length === 1 ? normalizedKey.toLowerCase() : normalizedKey,
		original: shortcut
	}
}

export function parseShortcuts(shortcuts: string | string[]): ParsedShortcut[] {
	const shortcutArray = Array.isArray(shortcuts) ? shortcuts : [shortcuts]
	return shortcutArray.map(parseShortcut)
}

export function getModifiersFromEvent(event: KeyboardEvent): ModifierState {
	return {
		meta: event.metaKey,
		ctrl: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey
	}
}

export function matchesShortcut(event: KeyboardEvent, parsed: ParsedShortcut): boolean {
	const eventModifiers = getModifiersFromEvent(event)
	const eventKey = event.key.toLowerCase()

	const modifiersMatch =
		eventModifiers.meta === parsed.modifiers.meta &&
		eventModifiers.ctrl === parsed.modifiers.ctrl &&
		eventModifiers.alt === parsed.modifiers.alt &&
		eventModifiers.shift === parsed.modifiers.shift

	const keyMatches = eventKey === parsed.key.toLowerCase()

	return modifiersMatch && keyMatches
}

export function matchesAnyShortcut(
	event: KeyboardEvent,
	parsedShortcuts: ParsedShortcut[]
): boolean {
	return parsedShortcuts.some((parsed) => matchesShortcut(event, parsed))
}

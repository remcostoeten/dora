import { useEffect, useRef } from 'react'
import { matchesShortcut, parseShortcuts } from '@remcostoeten/use-shortcut/parser'

/**
 * @name matchesRailCombo
 * @description Matches a keydown against a combo, also reading digits from the physical key so `shift+1` fires even though the event's key is `!`.
 * @example matchesRailCombo(event, 'shift+1')
 */
export function matchesRailCombo(event: KeyboardEvent, combo: string | string[]) {
	const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1]
	return parseShortcuts(combo).some(function (parsed) {
		if (matchesShortcut(event, parsed)) return true
		if (!digit || parsed.key !== digit) return false
		const { meta, ctrl, alt, shift } = parsed.modifiers
		return (
			event.metaKey === meta &&
			event.ctrlKey === ctrl &&
			event.altKey === alt &&
			event.shiftKey === shift
		)
	})
}

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.isContentEditable ||
		target.closest('input, textarea, select, [role="textbox"], .monaco-editor') !== null
	)
}

/**
 * @name useRailShortcuts
 * @description Calls `onSelect` with the rail position (0-based) whose combo matches a keydown outside text inputs.
 * @example useRailShortcuts([shortcuts.gotoRailItem1.combo], function (index) {})
 */
export function useRailShortcuts(
	combos: Array<string | string[]>,
	onSelect: (index: number) => void
) {
	const latest = useRef({ combos, onSelect })
	latest.current = { combos, onSelect }

	useEffect(function () {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.repeat || isTypingTarget(event.target)) return
			const index = latest.current.combos.findIndex(function (combo) {
				return matchesRailCombo(event, combo)
			})
			if (index === -1) return
			event.preventDefault()
			latest.current.onSelect(index)
		}
		window.addEventListener('keydown', handleKeyDown)
		return function () {
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])
}

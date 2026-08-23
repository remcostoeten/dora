import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
	APP_SHORTCUTS,
	findShortcutConflict,
	formatShortcutList,
	getEffectiveShortcuts,
	normalizeShortcut,
	useShortcut,
	useShortcutStore,
	type ShortcutDefinition
} from '@studio/core/shortcuts'

function NewConnectionShortcut({ onToggle }: { onToggle: () => void }) {
	const $ = useShortcut({ ignoreInputs: false })
	$.bind(APP_SHORTCUTS.newConnection.combo).on(onToggle)

	return <input aria-label="Connection name" />
}

describe('shortcuts', function () {
	beforeEach(function () {
		useShortcutStore.getState().resetAll()
	})

	it('normalizes modifier order and aliases for conflict checks', function () {
		expect(normalizeShortcut('Shift+Command+K')).toBe('mod+shift+k')
		expect(normalizeShortcut('ctrl+ArrowUp')).toBe('ctrl+up')
	})

	it('finds conflicts across overlapping shortcut scopes', function () {
		const shortcuts = APP_SHORTCUTS as Record<keyof typeof APP_SHORTCUTS, ShortcutDefinition>

		const conflict = findShortcutConflict('openSettings', 'mod+k', shortcuts)

		expect(conflict?.name).toBe('openCommandPalette')
		expect(conflict?.combo).toBe('mod+k')
	})

	it('does not flag the same combo in unrelated non-global scopes', function () {
		const shortcuts = APP_SHORTCUTS as Record<keyof typeof APP_SHORTCUTS, ShortcutDefinition>

		const conflict = findShortcutConflict('filterRows', 'mod+shift+f', shortcuts)

		expect(conflict).toBeNull()
	})

	it('formats every combo in multi-combo shortcuts', function () {
		const formatted = formatShortcutList(['escape', 'mod+d'])

		expect(formatted).toContain('/')
		expect(formatted.toLowerCase()).toContain('esc')
		expect(formatted.toLowerCase()).toContain('d')
	})

	it('prevents conflicting shortcut overrides in the store', function () {
		const listener = vi.fn()
		window.addEventListener('dora-shortcut-conflict', listener)

		useShortcutStore.getState().setShortcut('openSettings', 'mod+k')

		expect(useShortcutStore.getState().overrides.openSettings).toBeUndefined()
		expect(listener).toHaveBeenCalledTimes(1)
		expect((listener.mock.calls[0][0] as CustomEvent).detail.conflictingName).toBe(
			'openCommandPalette'
		)

		window.removeEventListener('dora-shortcut-conflict', listener)
	})

	it('preserves multi-combo overrides as arrays in effective shortcuts', function () {
		useShortcutStore.getState().setShortcut('deselect', ['x', 'mod+d'])

		expect(useShortcutStore.getState().overrides.deselect).toEqual(['x', 'mod+d'])
		expect(getEffectiveShortcuts(useShortcutStore.getState().overrides).deselect.combo).toEqual([
			'x',
			'mod+d'
		])
	})

	it('toggles a new connection while an input is focused', function () {
		const onToggle = vi.fn()
		render(<NewConnectionShortcut onToggle={onToggle} />)

		const input = screen.getByRole('textbox', { name: 'Connection name' })
		input.focus()
		fireEvent.keyDown(input, { key: 'n', ctrlKey: true })

		expect(onToggle).toHaveBeenCalledTimes(1)
	})
})

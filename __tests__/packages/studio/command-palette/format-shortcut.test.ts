import { describe, expect, it } from 'vitest'
import { formatShortcut } from '@studio/features/command-palette/format-shortcut'

describe('formatShortcut', function () {
	it('joins tokens with + off Apple platforms', function () {
		expect(formatShortcut('mod+k', false)).toBe('Ctrl+K')
	})

	it('concatenates glyphs without a separator on Apple platforms', function () {
		expect(formatShortcut('mod+k', true)).toBe('⌘K')
	})

	it('maps mod to the platform-native modifier', function () {
		expect(formatShortcut('mod', true)).toBe('⌘')
		expect(formatShortcut('mod', false)).toBe('Ctrl')
	})

	it('renders each named key as a glyph on Apple platforms', function () {
		expect(formatShortcut('shift+enter', true)).toBe('⇧↵')
		expect(formatShortcut('alt+escape', true)).toBe('⌥⎋')
	})

	it('spells named keys out off Apple platforms', function () {
		expect(formatShortcut('shift+enter', false)).toBe('Shift+Enter')
		expect(formatShortcut('alt+escape', false)).toBe('Alt+Esc')
	})

	it('uppercases single unmapped characters', function () {
		expect(formatShortcut('mod+shift+p', false)).toBe('Ctrl+Shift+P')
	})

	it('capitalizes multi-character unmapped tokens', function () {
		expect(formatShortcut('mod+tab', false)).toBe('Ctrl+Tab')
	})

	it('is case- and whitespace-insensitive about its input', function () {
		expect(formatShortcut(' MOD + K ', false)).toBe('Ctrl+K')
	})
})

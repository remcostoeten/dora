import { describe, expect, it } from 'vitest'
import { getRailNavIds, matchesRailCombo } from '@studio/features/app-sidebar'

function key(init: KeyboardEventInit) {
	return new KeyboardEvent('keydown', init)
}

describe('matchesRailCombo', () => {
	it('matches shift+digit by physical key when the key is a symbol', () => {
		expect(matchesRailCombo(key({ key: '!', code: 'Digit1', shiftKey: true }), 'shift+1')).toBe(
			true
		)
	})

	it('rejects a different digit or missing shift', () => {
		expect(matchesRailCombo(key({ key: '@', code: 'Digit2', shiftKey: true }), 'shift+1')).toBe(
			false
		)
		expect(matchesRailCombo(key({ key: '1', code: 'Digit1' }), 'shift+1')).toBe(false)
	})

	it('still matches a recorded symbol combo and non-digit combos', () => {
		expect(matchesRailCombo(key({ key: '!', code: 'Digit1', shiftKey: true }), 'shift+!')).toBe(
			true
		)
		expect(matchesRailCombo(key({ key: 'K', code: 'KeyK', shiftKey: true }), 'shift+k')).toBe(
			true
		)
	})
})

describe('getRailNavIds', () => {
	it('lists the rail in order with settings last', () => {
		const ids = getRailNavIds(false)
		expect(ids[0]).toBe('sql-console')
		expect(ids.at(-1)).toBe('settings')
		expect(getRailNavIds(true)).toContain('analytics')
		expect(ids).not.toContain('analytics')
	})
})

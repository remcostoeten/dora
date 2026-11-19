import { describe, expect, it } from 'vitest'
import { APP_SHORTCUTS, getEffectiveShortcuts } from '@studio/core/shortcuts'
import {
	GRID_COMMANDS,
	SEQUENCE_TIMEOUT_MS,
	buildGridKeymap,
	getSequencePrefixes,
	isBareKey,
	isSequenceContinuation,
	resolveGridCommand
} from '@studio/features/database-studio/components/data-grid/grid-commands'

function keydown(key: string, init: KeyboardEventInit = {}) {
	return new KeyboardEvent('keydown', { key, ...init })
}

describe('GRID_COMMANDS', function () {
	it('registers every command in the data-grid scope of the shortcut registry', function () {
		for (const command of GRID_COMMANDS) {
			expect(APP_SHORTCUTS[command.id].scope).toBe('data-grid')
		}
	})

	it('lists each command once', function () {
		const ids = GRID_COMMANDS.map(function (command) {
			return command.id
		})
		expect(new Set(ids).size).toBe(ids.length)
	})
})

describe('resolveGridCommand', function () {
	const keymap = buildGridKeymap(getEffectiveShortcuts())

	it('matches the default combos', function () {
		expect(resolveGridCommand(keydown('ArrowDown'), keymap, true)?.id).toBe('gridMoveDown')
		expect(resolveGridCommand(keydown('ArrowDown', { shiftKey: true }), keymap, true)?.id).toBe(
			'gridExtendDown'
		)
		expect(resolveGridCommand(keydown('ArrowDown', { ctrlKey: true }), keymap, true)?.id).toBe(
			'gridJumpBottom'
		)
		expect(resolveGridCommand(keydown('F2'), keymap, true)?.id).toBe('editCell')
		expect(resolveGridCommand(keydown(' '), keymap, true)?.id).toBe('gridToggleRow')
		expect(resolveGridCommand(keydown('F10', { shiftKey: true }), keymap, true)?.id).toBe(
			'gridOpenCellMenu'
		)
		expect(resolveGridCommand(keydown('ContextMenu'), keymap, true)?.id).toBe(
			'gridOpenCellMenu'
		)
	})

	it('requires the exact modifiers of a combo', function () {
		expect(resolveGridCommand(keydown('Enter', { ctrlKey: true }), keymap, true)).toBeNull()
		expect(resolveGridCommand(keydown('Delete', { ctrlKey: true }), keymap, true)).toBeNull()
		expect(resolveGridCommand(keydown('F10'), keymap, true)).toBeNull()
	})

	it('skips cell commands while no cell is focused', function () {
		expect(resolveGridCommand(keydown('s'), keymap, false)).toBeNull()
		expect(resolveGridCommand(keydown('a', { ctrlKey: true }), keymap, false)?.id).toBe(
			'selectAll'
		)
		expect(resolveGridCommand(keydown('Escape'), keymap, false)?.id).toBe('deselect')
	})

	it('jumps to the action bar on Alt+T and F6, from a cell or the header', function () {
		expect(resolveGridCommand(keydown('t', { altKey: true }), keymap, true)?.id).toBe(
			'focusToolbar'
		)
		expect(resolveGridCommand(keydown('F6'), keymap, false)?.id).toBe('focusToolbar')
		expect(resolveGridCommand(keydown('F6'), keymap, true, 'header')?.id).toBe('focusToolbar')
	})

	it('follows a user remap from the registry', function () {
		const remapped = buildGridKeymap(getEffectiveShortcuts({ gridSortColumn: 'x' }))
		expect(resolveGridCommand(keydown('x'), remapped, true)?.id).toBe('gridSortColumn')
		expect(resolveGridCommand(keydown('s'), remapped, true)).toBeNull()
	})
})

describe('resolveGridCommand in the header row', function () {
	const keymap = buildGridKeymap(getEffectiveShortcuts())

	it('gives Enter and the header letters their header meaning', function () {
		expect(resolveGridCommand(keydown('Enter'), keymap, true, 'header')?.id).toBe(
			'gridHeaderSort'
		)
		expect(resolveGridCommand(keydown('h'), keymap, true, 'header')?.id).toBe('gridHideColumn')
		expect(resolveGridCommand(keydown('f'), keymap, true, 'header')?.id).toBe(
			'gridFilterColumn'
		)
	})

	it('keeps header letters out of the body and cell commands out of the header', function () {
		expect(resolveGridCommand(keydown('h'), keymap, true, 'cell')).toBeNull()
		expect(resolveGridCommand(keydown('f'), keymap, true, 'cell')).toBeNull()
		expect(resolveGridCommand(keydown('Enter'), keymap, true, 'cell')?.id).toBe('editCell')
		expect(resolveGridCommand(keydown('Delete'), keymap, true, 'header')).toBeNull()
		expect(resolveGridCommand(keydown('d'), keymap, true, 'header')).toBeNull()
		expect(resolveGridCommand(keydown('Backspace'), keymap, true, 'header')).toBeNull()
	})

	it('shares sort, resize and navigation between both regions', function () {
		for (const region of ['cell', 'header'] as const) {
			expect(resolveGridCommand(keydown('s'), keymap, true, region)?.id).toBe(
				'gridSortColumn'
			)
			expect(
				resolveGridCommand(keydown('ArrowUp', { altKey: true }), keymap, true, region)?.id
			).toBe('gridSortAscending')
			expect(
				resolveGridCommand(keydown('ArrowRight', { altKey: true }), keymap, true, region)
					?.id
			).toBe('gridWidenColumn')
			expect(resolveGridCommand(keydown('ArrowLeft'), keymap, true, region)?.id).toBe(
				'gridMoveLeft'
			)
		}
	})
})

describe('resolveGridCommand in the cell editor', function () {
	const keymap = buildGridKeymap(getEffectiveShortcuts())

	it('runs only the editing commands while a cell is being edited', function () {
		expect(
			resolveGridCommand(
				keydown('Enter', { ctrlKey: true, shiftKey: true }),
				keymap,
				true,
				'editing'
			)?.id
		).toBe('gridFillSelection')
		expect(
			resolveGridCommand(keydown('?', { shiftKey: true }), keymap, true, 'editing')
		).toBeNull()
		expect(resolveGridCommand(keydown('d'), keymap, true, 'editing')).toBeNull()
		expect(
			resolveGridCommand(keydown('z', { ctrlKey: true }), keymap, true, 'editing')
		).toBeNull()
	})

	it('opens help with a question mark outside the editor', function () {
		expect(resolveGridCommand(keydown('?', { shiftKey: true }), keymap, true)?.id).toBe(
			'gridShowHelp'
		)
		expect(resolveGridCommand(keydown('?', { shiftKey: true }), keymap, false)?.id).toBe(
			'gridShowHelp'
		)
	})
})

describe('getSequencePrefixes', function () {
	it('collects the first key of chords written with a space or with then', function () {
		expect(
			getSequencePrefixes({
				a: { combo: 'g d' },
				b: { combo: ['mod+k', 'x then y'] },
				c: { combo: 'mod+shift+p' }
			})
		).toEqual(new Set(['g', 'x']))
	})

	it('finds the go-to chords of the default registry', function () {
		expect(getSequencePrefixes(APP_SHORTCUTS)).toEqual(new Set(['g']))
	})
})

describe('isSequenceContinuation', function () {
	it('is true only inside the sequence timeout', function () {
		expect(isSequenceContinuation(null, 100)).toBe(false)
		expect(isSequenceContinuation(100, 100 + SEQUENCE_TIMEOUT_MS)).toBe(true)
		expect(isSequenceContinuation(100, 101 + SEQUENCE_TIMEOUT_MS)).toBe(false)
	})
})

describe('isBareKey', function () {
	it('accepts lone printable keys and rejects named or modified ones', function () {
		expect(isBareKey(keydown('g'))).toBe(true)
		expect(isBareKey(keydown('G', { shiftKey: true }))).toBe(true)
		expect(isBareKey(keydown('g', { ctrlKey: true }))).toBe(false)
		expect(isBareKey(keydown('Enter'))).toBe(false)
	})
})

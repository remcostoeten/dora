import { describe, expect, it } from 'vitest'
import { getEffectiveShortcuts } from '@studio/core/shortcuts'
import {
	buildCheatSheet,
	filterCheatSheet
} from '@studio/features/database-studio/components/data-grid/grid-cheat-sheet'
import {
	GRID_COMMANDS,
	GRID_COMMAND_SECTIONS
} from '@studio/features/database-studio/components/data-grid/grid-commands'

function plain(combo: string) {
	return combo
}

describe('buildCheatSheet', function () {
	it('lists exactly the commands of the command table', function () {
		const sheet = buildCheatSheet(getEffectiveShortcuts())
		const listed = sheet.flatMap((section) => section.entries.map((entry) => entry.id))
		const commands = GRID_COMMANDS.map((command) => command.id)

		expect(listed.toSorted()).toEqual(commands.toSorted())
		expect(sheet.map((section) => section.title)).toEqual(
			GRID_COMMAND_SECTIONS.map((section) => section.title)
		)
	})

	it('shows the remapped combo of a command', function () {
		const sheet = buildCheatSheet(
			getEffectiveShortcuts({ gridUndo: 'alt+u' }),
			GRID_COMMAND_SECTIONS,
			plain
		)
		const undo = sheet
			.flatMap((section) => section.entries)
			.find((entry) => entry.id === 'gridUndo')
		expect(undo).toEqual({ id: 'gridUndo', description: 'Undo', combos: ['alt+u'] })
	})

	it('lists every combo of a command with several', function () {
		const sheet = buildCheatSheet(getEffectiveShortcuts(), GRID_COMMAND_SECTIONS, plain)
		const redo = sheet
			.flatMap((section) => section.entries)
			.find((entry) => entry.id === 'gridRedo')
		expect(redo?.combos).toEqual(['mod+shift+z', 'mod+y'])
	})
})

describe('filterCheatSheet', function () {
	const sheet = buildCheatSheet(getEffectiveShortcuts(), GRID_COMMAND_SECTIONS, plain)

	it('returns the whole sheet for a blank query', function () {
		expect(filterCheatSheet(sheet, '  ')).toBe(sheet)
	})

	it('matches descriptions, combos and section titles', function () {
		const byDescription = filterCheatSheet(sheet, 'fill down')
		expect(
			byDescription.flatMap((section) => section.entries.map((entry) => entry.id))
		).toEqual(['gridFillDown'])

		const byCombo = filterCheatSheet(sheet, 'mod+g')
		expect(byCombo.flatMap((section) => section.entries.map((entry) => entry.id))).toEqual([
			'gridGoToCell'
		])

		const bySection = filterCheatSheet(sheet, 'header row')
		expect(bySection.map((section) => section.title)).toContain('Header row')
	})

	it('returns nothing when no entry matches', function () {
		expect(filterCheatSheet(sheet, 'zzzz')).toEqual([])
	})
})

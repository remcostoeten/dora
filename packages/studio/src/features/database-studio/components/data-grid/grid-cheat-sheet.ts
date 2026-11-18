import {
	formatShortcut,
	toShortcutList,
	type ShortcutDefinition,
	type ShortcutName
} from '@studio/core/shortcuts'
import { GRID_COMMAND_SECTIONS, type GridCommandSection } from './grid-commands'

export type CheatSheetEntry = {
	id: ShortcutName
	description: string
	combos: string[]
}

export type CheatSheetSection = {
	title: string
	entries: CheatSheetEntry[]
}

/**
 * @name buildCheatSheet
 * @description Builds the grid cheat sheet from the command table and the
 * effective shortcuts, so it lists exactly the commands the grid runs with the
 * combos the user has. A command with no combo left is omitted.
 *
 * @example
 * const sheet = buildCheatSheet(getEffectiveShortcuts(overrides))
 */
export function buildCheatSheet(
	shortcuts: Record<ShortcutName, ShortcutDefinition>,
	sections: readonly GridCommandSection[] = GRID_COMMAND_SECTIONS,
	format: (combo: string) => string = formatShortcut
): CheatSheetSection[] {
	return sections
		.map((section) => ({
			title: section.title,
			entries: section.commands
				.map((command) => {
					const definition = shortcuts[command.id]
					return {
						id: command.id,
						description: definition.description,
						combos: toShortcutList(definition.combo).map((combo) => format(combo))
					}
				})
				.filter((entry) => entry.combos.length > 0)
		}))
		.filter((section) => section.entries.length > 0)
}

/**
 * @name filterCheatSheet
 * @description Narrows the cheat sheet to the entries whose description,
 * section title or combo contains the query, ignoring case.
 *
 * @example
 * filterCheatSheet(sheet, 'undo')
 */
export function filterCheatSheet(sheet: CheatSheetSection[], query: string): CheatSheetSection[] {
	const wanted = query.trim().toLowerCase()
	if (wanted === '') return sheet
	return sheet
		.map((section) => ({
			title: section.title,
			entries: section.title.toLowerCase().includes(wanted)
				? section.entries
				: section.entries.filter(
						(entry) =>
							entry.description.toLowerCase().includes(wanted) ||
							entry.combos.some((combo) => combo.toLowerCase().includes(wanted))
					)
		}))
		.filter((section) => section.entries.length > 0)
}

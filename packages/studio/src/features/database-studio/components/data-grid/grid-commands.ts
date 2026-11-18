import {
	matchesAnyShortcut,
	parseShortcuts,
	toShortcutList,
	type ShortcutDefinition,
	type ShortcutName
} from '@studio/core/shortcuts'
import { ColumnDefinition } from '../../types'
import { getColumnDefault } from '../../utils/studio-data'
import { copySelectionToClipboard, getCellsToClear, pasteClipboardIntoGrid } from './grid-clipboard'
import {
	getEdgeTarget,
	getStepTarget,
	getTabTarget,
	isSameCell,
	type GridDirection
} from './grid-navigation'
import { getCellKey } from './selection'
import { CellPosition } from './types'

export type GridCommandContext = {
	allSelected: boolean
	anchorCell: CellPosition | null
	columns: ColumnDefinition[]
	focusedCell: CellPosition | null
	lastClickedRow: number | null
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	cancelPendingNavigation: () => void
	moveTo: (target: CellPosition, extend: boolean) => void
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onDeleteSelectedRows?: () => void
	onOpenCellMenu?: (rowIndex: number, colIndex: number) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	onSortColumn?: (columnName: string) => void
	setFocusedCell: (cell: CellPosition | null) => void
	setLastClickedRow: (rowIndex: number) => void
	startCellEdit: (rowIndex: number, columnName: string, currentValue: unknown) => void
	updateCellSelection: (cells: Set<string>) => void
}

export type GridCommandOutcome = 'handled' | 'pass'

export type GridCommand = {
	id: ShortcutName
	needsCell: boolean
	blockedByMask: boolean
	run: (context: GridCommandContext) => GridCommandOutcome
}

type CellRun = (context: GridCommandContext, cell: CellPosition) => GridCommandOutcome | void

type CommandFlags = {
	blockedByMask?: boolean
}

function cellCommand(id: ShortcutName, run: CellRun, flags: CommandFlags = {}): GridCommand {
	return {
		id,
		needsCell: true,
		blockedByMask: flags.blockedByMask ?? false,
		run: function (context) {
			if (!context.focusedCell) return 'pass'
			return run(context, context.focusedCell) ?? 'handled'
		}
	}
}

function gridCommand(
	id: ShortcutName,
	run: (context: GridCommandContext) => GridCommandOutcome | void,
	flags: CommandFlags = {}
): GridCommand {
	return {
		id,
		needsCell: false,
		blockedByMask: flags.blockedByMask ?? false,
		run: function (context) {
			return run(context) ?? 'handled'
		}
	}
}

function getBounds(context: GridCommandContext) {
	return { rowCount: context.rows.length, colCount: context.columns.length }
}

function stepCommand(id: ShortcutName, direction: GridDirection, extend: boolean): GridCommand {
	return cellCommand(id, function (context, cell) {
		const target = getStepTarget(cell, direction, getBounds(context))
		if (!isSameCell(target, cell)) context.moveTo(target, extend)
	})
}

function edgeCommand(id: ShortcutName, direction: GridDirection, extend: boolean): GridCommand {
	return cellCommand(id, function (context, cell) {
		context.moveTo(getEdgeTarget(cell, direction, getBounds(context)), extend)
	})
}

function tabCommand(id: ShortcutName, backwards: boolean): GridCommand {
	return cellCommand(id, function (context, cell) {
		const target = getTabTarget(cell, backwards, getBounds(context))
		if (!target) return 'pass'
		context.moveTo(target, false)
	})
}

function editFocusedCell(context: GridCommandContext, cell: CellPosition) {
	const column = context.columns[cell.col]
	context.startCellEdit(cell.row, column.name, context.rows[cell.row][column.name])
}

function clearSelectedCells(context: GridCommandContext, cell: CellPosition) {
	if (!context.onCellEdit) return
	for (const target of getCellsToClear(context.selectedCellsSet, cell)) {
		const column = context.columns[target.col]
		if (!column || column.primaryKey || !context.rows[target.row]) continue
		context.onCellEdit(target.row, column.name, getColumnDefault(column))
	}
}

function deselectProgressively(context: GridCommandContext) {
	context.cancelPendingNavigation()
	const cell = context.focusedCell
	if (cell && context.selectedCellsSet.size > 1) {
		context.updateCellSelection(new Set([getCellKey(cell.row, cell.col)]))
		return
	}
	if (context.selectedRows.size > 0) {
		context.onSelectAll(false)
		return
	}
	if (cell) {
		context.setFocusedCell(null)
		context.updateCellSelection(new Set())
	}
}

function toggleFocusedRow(context: GridCommandContext, cell: CellPosition) {
	context.onRowSelect(cell.row, !context.selectedRows.has(cell.row))
	context.setLastClickedRow(cell.row)
}

function selectRowRange(context: GridCommandContext, cell: CellPosition) {
	if (context.lastClickedRow === null || !context.onRowsSelect) {
		toggleFocusedRow(context, cell)
		return
	}
	const start = Math.min(context.lastClickedRow, cell.row)
	const end = Math.max(context.lastClickedRow, cell.row)
	const range: number[] = []
	for (let rowIndex = start; rowIndex <= end; rowIndex++) {
		range.push(rowIndex)
	}
	context.onRowsSelect(range, true)
}

function pasteIntoFocusedCell(context: GridCommandContext, cell: CellPosition) {
	if (!context.onCellEdit) return 'pass'
	pasteClipboardIntoGrid(cell, context.rows.length, context.columns, context.onCellEdit)
}

export const GRID_COMMANDS: readonly GridCommand[] = [
	stepCommand('gridMoveUp', 'up', false),
	stepCommand('gridMoveDown', 'down', false),
	stepCommand('gridMoveLeft', 'left', false),
	stepCommand('gridMoveRight', 'right', false),
	edgeCommand('gridJumpTop', 'up', false),
	edgeCommand('gridJumpBottom', 'down', false),
	edgeCommand('gridJumpRowStart', 'left', false),
	edgeCommand('gridJumpRowEnd', 'right', false),
	stepCommand('gridExtendUp', 'up', true),
	stepCommand('gridExtendDown', 'down', true),
	stepCommand('gridExtendLeft', 'left', true),
	stepCommand('gridExtendRight', 'right', true),
	edgeCommand('gridExtendTop', 'up', true),
	edgeCommand('gridExtendBottom', 'down', true),
	edgeCommand('gridExtendRowStart', 'left', true),
	edgeCommand('gridExtendRowEnd', 'right', true),
	tabCommand('gridNextCell', false),
	tabCommand('gridPrevCell', true),
	cellCommand('editCell', editFocusedCell, { blockedByMask: true }),
	cellCommand(
		'gridOpenCellMenu',
		function (context, cell) {
			context.onOpenCellMenu?.(cell.row, cell.col)
		},
		{ blockedByMask: true }
	),
	gridCommand(
		'deleteRows',
		function (context) {
			if (context.selectedRows.size === 0 && !context.focusedCell) return 'pass'
			context.onDeleteSelectedRows?.()
		},
		{ blockedByMask: true }
	),
	cellCommand('gridClearCells', clearSelectedCells, { blockedByMask: true }),
	gridCommand('deselect', deselectProgressively),
	cellCommand('gridToggleRow', toggleFocusedRow),
	cellCommand('gridSelectRowRange', selectRowRange),
	cellCommand('gridSortColumn', function (context, cell) {
		context.onSortColumn?.(context.columns[cell.col].name)
	}),
	gridCommand('selectAll', function (context) {
		context.onSelectAll(!context.allSelected)
	}),
	cellCommand(
		'gridCopyCells',
		function (context, cell) {
			copySelectionToClipboard(context.selectedCellsSet, cell, context.rows, context.columns)
		},
		{ blockedByMask: true }
	),
	cellCommand('gridPasteCells', pasteIntoFocusedCell, { blockedByMask: true })
]

export type GridKeymapEntry = {
	command: GridCommand
	shortcuts: ReturnType<typeof parseShortcuts>
}

/**
 * @name buildGridKeymap
 * @description Pairs every grid command with the parsed form of its effective
 * combos, so user remaps from the shortcut registry apply inside the grid.
 *
 * @example
 * const keymap = buildGridKeymap(getEffectiveShortcuts(overrides))
 */
export function buildGridKeymap(
	shortcuts: Record<ShortcutName, ShortcutDefinition>,
	commands: readonly GridCommand[] = GRID_COMMANDS
): GridKeymapEntry[] {
	return commands.map(function (command) {
		return {
			command,
			shortcuts: parseShortcuts(toShortcutList(shortcuts[command.id].combo))
		}
	})
}

/**
 * @name resolveGridCommand
 * @description Finds the first command whose combo matches the key event and
 * that can run in the current focus state. Returns null when the key is not a
 * grid command.
 *
 * @example
 * const command = resolveGridCommand(event, keymap, focusedCell !== null)
 * if (command) command.run(context)
 */
export function resolveGridCommand(
	event: KeyboardEvent,
	keymap: readonly GridKeymapEntry[],
	hasFocusedCell: boolean
): GridCommand | null {
	for (const entry of keymap) {
		if (entry.command.needsCell && !hasFocusedCell) continue
		if (matchesAnyShortcut(event, entry.shortcuts)) return entry.command
	}
	return null
}

/**
 * @name getSequencePrefixes
 * @description Collects the first key of every multi-step shortcut, such as
 * `g` from `g d`. The grid lets the key after a prefix through untouched so a
 * chord never doubles as a bare-letter grid command.
 *
 * @example
 * getSequencePrefixes({ gotoDashboard: { combo: 'g d', description: '' } })
 * // Set { 'g' }
 */
export function getSequencePrefixes(
	shortcuts: Record<string, Pick<ShortcutDefinition, 'combo'>>
): Set<string> {
	const prefixes = new Set<string>()
	for (const definition of Object.values(shortcuts)) {
		for (const combo of toShortcutList(definition.combo)) {
			// Sequence steps are separated by " then " or by a bare space.
			const steps = combo
				.trim()
				.toLowerCase()
				.split(/\s+then\s+|\s+/)
			if (steps.length > 1) prefixes.add(steps[0])
		}
	}
	return prefixes
}

export const SEQUENCE_TIMEOUT_MS = 800

/**
 * @name isSequenceContinuation
 * @description Whether a key pressed at `now` is the second step of a chord
 * whose prefix key was pressed at `prefixPressedAt`.
 *
 * @example
 * isSequenceContinuation(1000, 1400) // true, inside the 800ms window
 */
export function isSequenceContinuation(
	prefixPressedAt: number | null,
	now: number,
	timeoutMs = SEQUENCE_TIMEOUT_MS
): boolean {
	return prefixPressedAt !== null && now - prefixPressedAt <= timeoutMs
}

/**
 * @name isBareKey
 * @description Whether a key event is a single printable key with no command
 * modifier held.
 *
 * @example
 * isBareKey(new KeyboardEvent('keydown', { key: 'g' })) // true
 */
export function isBareKey(event: KeyboardEvent): boolean {
	return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

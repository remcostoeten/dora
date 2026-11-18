import {
	matchesAnyShortcut,
	parseShortcuts,
	toShortcutList,
	type ShortcutDefinition,
	type ShortcutName
} from '@studio/core/shortcuts'
import { ColumnDefinition } from '../../types'
import type { RowAction } from '../row-context-menu'
import { copySelectionToClipboard, getCellsToClear, readClipboardGrid } from './grid-clipboard'
import {
	describePasteDrop,
	describeSetNullRefusal,
	planClear,
	planFillDown,
	planPaste,
	planSetNull,
	type CellEdit,
	type GridNotice,
	type StagedAction
} from './grid-edits'
import {
	getEdgeTarget,
	getPageTarget,
	getStepTarget,
	getTabTarget,
	isSameCell,
	type GridDirection
} from './grid-navigation'
import {
	getCellKey,
	getColumnCells,
	getRowCells,
	getRowToggle,
	getSelectionSpan
} from './selection'
import { CellPosition } from './types'

export type GridCommandContext = {
	allSelected: boolean
	anchorCell: CellPosition | null
	columns: ColumnDefinition[]
	focusedCell: CellPosition | null
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	applyCellEdits?: (edits: CellEdit[]) => void
	cancelPendingNavigation: () => void
	getPageSize: () => number
	moveTo: (target: CellPosition, extend: boolean) => void
	notify: (notice: GridNotice) => void
	onInsertRow?: (rowIndex: number, position: 'above' | 'below') => void
	onOpenRowMenu?: (rowIndex: number) => void
	onRowAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	onDeleteSelectedRows?: () => void
	onOpenCellMenu?: (rowIndex: number, colIndex: number) => void
	onPageChange?: (direction: 'next' | 'prev') => void
	onRevertStaged?: (rowIndex: number, columnName: string | null) => void
	onStagedAction?: (action: StagedAction) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	onSortColumn?: (columnName: string) => void
	openGoToPrompt: () => void
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

function pageCommand(id: ShortcutName, direction: 'up' | 'down', extend: boolean): GridCommand {
	return cellCommand(id, function (context, cell) {
		const target = getPageTarget(cell, direction, context.getPageSize(), getBounds(context))
		if (!isSameCell(target, cell)) context.moveTo(target, extend)
	})
}

function cornerCommand(id: ShortcutName, corner: 'first' | 'last', extend: boolean): GridCommand {
	return cellCommand(id, function (context) {
		const bounds = getBounds(context)
		const target =
			corner === 'first'
				? { row: 0, col: 0 }
				: { row: bounds.rowCount - 1, col: bounds.colCount - 1 }
		context.moveTo(target, extend)
	})
}

function pagingCommand(id: ShortcutName, direction: 'next' | 'prev'): GridCommand {
	return gridCommand(id, function (context) {
		if (!context.onPageChange) return 'pass'
		context.onPageChange(direction)
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
	if (!context.applyCellEdits) return 'pass'
	const cells = getCellsToClear(context.selectedCellsSet, cell)
	context.applyCellEdits(planClear(cells, context.columns, context.rows))
}

function setSelectedCellsNull(context: GridCommandContext, cell: CellPosition) {
	if (!context.applyCellEdits) return 'pass'
	const cells = getCellsToClear(context.selectedCellsSet, cell)
	const plan = planSetNull(cells, context.columns, context.rows)
	const refusal = describeSetNullRefusal(plan.refusedColumns)
	if (refusal) context.notify({ level: 'warning', message: refusal })
	if (plan.edits.length > 0) context.applyCellEdits(plan.edits)
}

function fillDown(context: GridCommandContext, cell: CellPosition) {
	if (!context.applyCellEdits) return 'pass'
	const edits = planFillDown(context.selectedCellsSet, cell, context.columns, context.rows)
	if (edits.length === 0) {
		context.notify({ level: 'info', message: 'Nothing to fill down' })
		return
	}
	context.applyCellEdits(edits)
}

function runRowAction(action: RowAction, includeSelection: boolean): CellRun {
	return function (context, cell) {
		const row = context.rows[cell.row]
		if (!context.onRowAction || !row) return 'pass'
		const isBatch =
			includeSelection && context.selectedRows.size > 1 && context.selectedRows.has(cell.row)
		context.onRowAction(
			action,
			row,
			cell.row,
			isBatch ? Array.from(context.selectedRows) : undefined
		)
	}
}

function stagedCommand(id: ShortcutName, action: StagedAction): GridCommand {
	return gridCommand(
		id,
		function (context) {
			if (!context.onStagedAction) return 'pass'
			context.onStagedAction(action)
		},
		{ blockedByMask: true }
	)
}

function revertCommand(id: ShortcutName, scope: 'cell' | 'row'): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			if (!context.onRevertStaged) return 'pass'
			context.onRevertStaged(
				cell.row,
				scope === 'cell' ? context.columns[cell.col].name : null
			)
		},
		{ blockedByMask: true }
	)
}

function insertRowCommand(id: ShortcutName, position: 'above' | 'below'): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			if (!context.onInsertRow) return 'pass'
			context.onInsertRow(cell.row, position)
		},
		{ blockedByMask: true }
	)
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

function toggleSelectionRows(context: GridCommandContext, cell: CellPosition) {
	const span = getSelectionSpan(context.selectedCellsSet, cell, 'row')
	const toggle = getRowToggle(span, context.selectedRows)
	if (toggle.rowIndexes.length > 1 && context.onRowsSelect) {
		context.onRowsSelect(toggle.rowIndexes, toggle.checked)
	} else {
		context.onRowSelect(cell.row, !context.selectedRows.has(cell.row))
	}
	context.setLastClickedRow(cell.row)
}

function selectRowCells(context: GridCommandContext, cell: CellPosition) {
	const span = getSelectionSpan(context.selectedCellsSet, cell, 'row')
	context.updateCellSelection(getRowCells(span, context.columns.length))
}

function selectColumnCells(context: GridCommandContext, cell: CellPosition) {
	const span = getSelectionSpan(context.selectedCellsSet, cell, 'col')
	context.updateCellSelection(getColumnCells(span, context.rows.length))
}

function pasteIntoFocusedCell(context: GridCommandContext, cell: CellPosition) {
	const applyCellEdits = context.applyCellEdits
	if (!applyCellEdits) return 'pass'
	readClipboardGrid().then((pasteRows) => {
		if (!pasteRows) return
		const plan = planPaste(pasteRows, cell, context.rows.length, context.columns)
		const dropped = describePasteDrop(plan)
		if (dropped) context.notify({ level: 'warning', message: dropped })
		if (plan.edits.length > 0) applyCellEdits(plan.edits)
	})
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
	cornerCommand('gridFirstCell', 'first', false),
	cornerCommand('gridLastCell', 'last', false),
	pageCommand('gridPageUp', 'up', false),
	pageCommand('gridPageDown', 'down', false),
	gridCommand('gridGoToCell', function (context) {
		context.openGoToPrompt()
	}),
	pagingCommand('gridNextPage', 'next'),
	pagingCommand('gridPrevPage', 'prev'),
	stepCommand('gridExtendUp', 'up', true),
	stepCommand('gridExtendDown', 'down', true),
	stepCommand('gridExtendLeft', 'left', true),
	stepCommand('gridExtendRight', 'right', true),
	edgeCommand('gridExtendTop', 'up', true),
	edgeCommand('gridExtendBottom', 'down', true),
	edgeCommand('gridExtendRowStart', 'left', true),
	edgeCommand('gridExtendRowEnd', 'right', true),
	pageCommand('gridExtendPageUp', 'up', true),
	pageCommand('gridExtendPageDown', 'down', true),
	cornerCommand('gridExtendFirstCell', 'first', true),
	cornerCommand('gridExtendLastCell', 'last', true),
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
	cellCommand(
		'gridOpenRowMenu',
		function (context, cell) {
			context.onOpenRowMenu?.(cell.row)
		},
		{ blockedByMask: true }
	),
	cellCommand('gridEditRow', runRowAction('edit', false), { blockedByMask: true }),
	cellCommand('gridViewRow', runRowAction('view', false), { blockedByMask: true }),
	cellCommand('gridDuplicateRow', runRowAction('duplicate', true), { blockedByMask: true }),
	insertRowCommand('insertRow', 'below'),
	insertRowCommand('gridInsertRowAbove', 'above'),
	cellCommand('gridSetNull', setSelectedCellsNull, { blockedByMask: true }),
	cellCommand('gridFillDown', fillDown, { blockedByMask: true }),
	stagedCommand('gridToggleDryMode', 'toggle-dry-mode'),
	stagedCommand('gridApplyEdits', 'apply'),
	stagedCommand('gridDiscardEdits', 'discard'),
	stagedCommand('gridPreviewSql', 'preview'),
	stagedCommand('gridUndo', 'undo'),
	stagedCommand('gridRedo', 'redo'),
	revertCommand('gridRevertCell', 'cell'),
	revertCommand('gridRevertRow', 'row'),
	cellCommand('gridClearCells', clearSelectedCells, { blockedByMask: true }),
	gridCommand('deselect', deselectProgressively),
	cellCommand('gridToggleRow', toggleSelectionRows),
	cellCommand('gridSelectRowCells', selectRowCells),
	cellCommand('gridSelectColumnCells', selectColumnCells),
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

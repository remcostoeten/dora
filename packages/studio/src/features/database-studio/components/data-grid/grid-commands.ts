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
import { COLUMN_RESIZE_STEP } from './column-width'

export type GridRegion = 'cell' | 'header' | 'editing'

export type GridCommandContext = {
	allSelected: boolean
	anchorCell: CellPosition | null
	columns: ColumnDefinition[]
	focusedCell: CellPosition | null
	region: GridRegion
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	applyCellEdits?: (edits: CellEdit[]) => void
	autoFitColumn: (columnName: string, columnType?: string) => void
	cancelPendingNavigation: () => void
	commitFillSelection?: () => void
	enterHeader: () => void
	leaveHeader: (rowIndex: number) => void
	moveHeaderTo: (colIndex: number) => void
	onFilterColumn?: (columnName: string) => void
	onHideColumn?: (columnName: string) => void
	onSortDirection?: (columnName: string, direction: 'asc' | 'desc') => void
	resizeColumnBy: (columnName: string, delta: number) => void
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
	openHelp: () => void
	setFocusedCell: (cell: CellPosition | null) => void
	setLastClickedRow: (rowIndex: number) => void
	startCellEdit: (rowIndex: number, columnName: string, currentValue: unknown) => void
	updateCellSelection: (cells: Set<string>) => void
}

export type GridCommandOutcome = 'handled' | 'pass'

export type GridCommand = {
	id: ShortcutName
	needsCell: boolean
	regions: GridRegion | 'both'
	blockedByMask: boolean
	run: (context: GridCommandContext) => GridCommandOutcome
}

type CellRun = (context: GridCommandContext, cell: CellPosition) => GridCommandOutcome | void

type CommandFlags = {
	blockedByMask?: boolean
	regions?: GridRegion | 'both'
}

function cellCommand(id: ShortcutName, run: CellRun, flags: CommandFlags = {}): GridCommand {
	return {
		id,
		needsCell: true,
		regions: flags.regions ?? 'cell',
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
		regions: flags.regions ?? 'both',
		blockedByMask: flags.blockedByMask ?? false,
		run: function (context) {
			return run(context) ?? 'handled'
		}
	}
}

function getBounds(context: GridCommandContext) {
	return { rowCount: context.rows.length, colCount: context.columns.length }
}

const ANYWHERE: CommandFlags = { regions: 'both' }

function stepCommand(id: ShortcutName, direction: GridDirection, extend: boolean): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			const bounds = getBounds(context)
			if (context.region === 'header') {
				if (extend || direction === 'up') return
				if (direction === 'down') context.leaveHeader(0)
				else context.moveHeaderTo(getStepTarget(cell, direction, bounds).col)
				return
			}
			if (direction === 'up' && cell.row === 0 && !extend) {
				context.enterHeader()
				return
			}
			const target = getStepTarget(cell, direction, bounds)
			if (!isSameCell(target, cell)) context.moveTo(target, extend)
		},
		ANYWHERE
	)
}

function edgeCommand(id: ShortcutName, direction: GridDirection, extend: boolean): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			const target = getEdgeTarget(cell, direction, getBounds(context))
			if (context.region === 'header') {
				if (extend || direction === 'up') return
				if (direction === 'down') context.leaveHeader(target.row)
				else context.moveHeaderTo(target.col)
				return
			}
			context.moveTo(target, extend)
		},
		ANYWHERE
	)
}

function pageCommand(id: ShortcutName, direction: 'up' | 'down', extend: boolean): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			if (context.region === 'header') {
				if (direction === 'down' && !extend) context.leaveHeader(0)
				return
			}
			const target = getPageTarget(cell, direction, context.getPageSize(), getBounds(context))
			if (!isSameCell(target, cell)) context.moveTo(target, extend)
		},
		ANYWHERE
	)
}

function cornerCommand(id: ShortcutName, corner: 'first' | 'last', extend: boolean): GridCommand {
	return cellCommand(
		id,
		function (context) {
			const bounds = getBounds(context)
			if (context.region === 'header') {
				if (extend) return
				if (corner === 'first') context.moveHeaderTo(0)
				else context.leaveHeader(bounds.rowCount - 1)
				return
			}
			const target =
				corner === 'first'
					? { row: 0, col: 0 }
					: { row: bounds.rowCount - 1, col: bounds.colCount - 1 }
			context.moveTo(target, extend)
		},
		ANYWHERE
	)
}

function sortDirectionCommand(id: ShortcutName, direction: 'asc' | 'desc'): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			if (!context.onSortDirection) return 'pass'
			context.onSortDirection(context.columns[cell.col].name, direction)
		},
		ANYWHERE
	)
}

function resizeCommand(id: ShortcutName, delta: number): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			context.resizeColumnBy(context.columns[cell.col].name, delta)
		},
		ANYWHERE
	)
}

function columnIntentCommand(
	id: ShortcutName,
	pick: (context: GridCommandContext) => ((columnName: string) => void) | undefined,
	regions: GridRegion | 'both'
): GridCommand {
	return cellCommand(
		id,
		function (context, cell) {
			const intent = pick(context)
			if (!intent) return 'pass'
			intent(context.columns[cell.col].name)
		},
		{ regions }
	)
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
	if (context.region === 'header') {
		context.leaveHeader(0)
		return
	}
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

export type GridCommandSection = {
	title: string
	commands: readonly GridCommand[]
}

export const GRID_COMMAND_SECTIONS: readonly GridCommandSection[] = [
	{
		title: 'Move',
		commands: [
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
			tabCommand('gridNextCell', false),
			tabCommand('gridPrevCell', true),
			gridCommand('gridGoToCell', function (context) {
				context.openGoToPrompt()
			}),
			pagingCommand('gridNextPage', 'next'),
			pagingCommand('gridPrevPage', 'prev')
		]
	},
	{
		title: 'Select',
		commands: [
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
			cellCommand('gridSelectRowCells', selectRowCells),
			cellCommand('gridSelectColumnCells', selectColumnCells),
			cellCommand('gridToggleRow', toggleSelectionRows),
			gridCommand('selectAll', function (context) {
				context.onSelectAll(!context.allSelected)
			}),
			gridCommand('deselect', deselectProgressively)
		]
	},
	{
		title: 'Edit cells',
		commands: [
			cellCommand('editCell', editFocusedCell, { blockedByMask: true }),
			gridCommand(
				'gridFillSelection',
				function (context) {
					if (!context.commitFillSelection) return 'pass'
					context.commitFillSelection()
				},
				{ blockedByMask: true, regions: 'editing' }
			),
			cellCommand('gridClearCells', clearSelectedCells, { blockedByMask: true }),
			cellCommand('gridSetNull', setSelectedCellsNull, { blockedByMask: true }),
			cellCommand('gridFillDown', fillDown, { blockedByMask: true }),
			cellCommand(
				'gridCopyCells',
				function (context, cell) {
					copySelectionToClipboard(
						context.selectedCellsSet,
						cell,
						context.rows,
						context.columns
					)
				},
				{ blockedByMask: true }
			),
			cellCommand('gridPasteCells', pasteIntoFocusedCell, { blockedByMask: true }),
			cellCommand(
				'gridOpenCellMenu',
				function (context, cell) {
					context.onOpenCellMenu?.(cell.row, cell.col)
				},
				{ blockedByMask: true }
			)
		]
	},
	{
		title: 'Rows',
		commands: [
			cellCommand(
				'gridOpenRowMenu',
				function (context, cell) {
					context.onOpenRowMenu?.(cell.row)
				},
				{ blockedByMask: true }
			),
			cellCommand('gridEditRow', runRowAction('edit', false), { blockedByMask: true }),
			cellCommand('gridViewRow', runRowAction('view', false), { blockedByMask: true }),
			cellCommand('gridDuplicateRow', runRowAction('duplicate', true), {
				blockedByMask: true
			}),
			insertRowCommand('insertRow', 'below'),
			insertRowCommand('gridInsertRowAbove', 'above'),
			gridCommand(
				'deleteRows',
				function (context) {
					if (context.selectedRows.size === 0 && !context.focusedCell) return 'pass'
					context.onDeleteSelectedRows?.()
				},
				{ blockedByMask: true, regions: 'cell' }
			)
		]
	},
	{
		title: 'Dry run and undo',
		commands: [
			stagedCommand('gridToggleDryMode', 'toggle-dry-mode'),
			stagedCommand('gridApplyEdits', 'apply'),
			stagedCommand('gridDiscardEdits', 'discard'),
			revertCommand('gridRevertCell', 'cell'),
			revertCommand('gridRevertRow', 'row'),
			stagedCommand('gridPreviewSql', 'preview'),
			stagedCommand('gridUndo', 'undo'),
			stagedCommand('gridRedo', 'redo')
		]
	},
	{
		title: 'Columns',
		commands: [
			cellCommand(
				'gridSortColumn',
				function (context, cell) {
					context.onSortColumn?.(context.columns[cell.col].name)
				},
				ANYWHERE
			),
			sortDirectionCommand('gridSortAscending', 'asc'),
			sortDirectionCommand('gridSortDescending', 'desc'),
			resizeCommand('gridNarrowColumn', -COLUMN_RESIZE_STEP),
			resizeCommand('gridWidenColumn', COLUMN_RESIZE_STEP),
			cellCommand(
				'gridAutoFitColumn',
				function (context, cell) {
					const column = context.columns[cell.col]
					context.autoFitColumn(column.name, column.type)
				},
				ANYWHERE
			),
			columnIntentCommand('filterRows', (context) => context.onFilterColumn, 'both')
		]
	},
	{
		title: 'Header row',
		commands: [
			cellCommand(
				'gridHeaderSort',
				function (context, cell) {
					context.onSortColumn?.(context.columns[cell.col].name)
				},
				{ regions: 'header' }
			),
			columnIntentCommand('gridHideColumn', (context) => context.onHideColumn, 'header'),
			columnIntentCommand('gridFilterColumn', (context) => context.onFilterColumn, 'header')
		]
	},
	{
		title: 'Help',
		commands: [
			gridCommand('gridShowHelp', function (context) {
				context.openHelp()
			})
		]
	}
]

const REGION_PRIORITY: Record<GridCommand['regions'], number> = {
	header: 0,
	editing: 0,
	cell: 1,
	both: 2
}

export const GRID_COMMANDS: readonly GridCommand[] = GRID_COMMAND_SECTIONS.flatMap(
	(section) => section.commands
).sort((a, b) => REGION_PRIORITY[a.regions] - REGION_PRIORITY[b.regions])

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
 * @name runsInRegion
 * @description Whether a command runs where the focus is. `both` covers the
 * body cells and the header row, never the cell editor.
 *
 * @example
 * runsInRegion(command, 'header')
 */
export function runsInRegion(command: GridCommand, region: GridRegion): boolean {
	if (command.regions === 'both') return region !== 'editing'
	return command.regions === region
}

/**
 * @name resolveGridCommand
 * @description Finds the first command whose combo matches the key event and
 * that can run in the current focus state. Returns null when the key is not a
 * grid command.
 *
 * @example
 * const command = resolveGridCommand(event, keymap, focusedCell !== null, 'cell')
 * if (command) command.run(context)
 */
export function resolveGridCommand(
	event: KeyboardEvent,
	keymap: readonly GridKeymapEntry[],
	hasFocusedCell: boolean,
	region: GridRegion = 'cell'
): GridCommand | null {
	for (const entry of keymap) {
		if (entry.command.needsCell && !hasFocusedCell) continue
		if (!runsInRegion(entry.command, region)) continue
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

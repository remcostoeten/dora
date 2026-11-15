import { readUrlParam, writeUrlParams } from './url-params'

type CellPosition = {
	row: number
	col: number
}

type ContextMenuValue = {
	kind: 'cell' | 'row'
	cell: CellPosition
	x: number
	y: number
}

export type StudioUrlState = {
	focusedCell: CellPosition | null
	selectedRow: number | null
	selectedCells: Set<string>
	contextMenu: ContextMenuValue | null
	addRecordMode: boolean
	addRecordIndex: number | null
}

const MAX_SERIALIZED_CELLS = 50

function parseInteger(value: string | null): number | null {
	if (value === null || value === '') return null
	const parsed = parseInt(value, 10)
	return isNaN(parsed) ? null : parsed
}

function parseCellPosition(value: string | null): CellPosition | null {
	if (!value) return null
	const parts = value.split(':')
	if (parts.length !== 2) return null
	const row = parseInt(parts[0], 10)
	const col = parseInt(parts[1], 10)
	if (isNaN(row) || isNaN(col)) return null
	return { row, col }
}

function parseContextMenu(value: string | null): ContextMenuValue | null {
	if (!value) return null
	const parts = value.split(':')
	const kind = parts[0]

	if (kind === 'cell') {
		if (parts.length !== 5) return null
		const row = parseInt(parts[1], 10)
		const col = parseInt(parts[2], 10)
		const x = parseInt(parts[3], 10)
		const y = parseInt(parts[4], 10)
		if (isNaN(row) || isNaN(col) || isNaN(x) || isNaN(y)) return null
		return { kind, cell: { row, col }, x, y }
	}

	if (kind === 'row') {
		if (parts.length !== 4) return null
		const row = parseInt(parts[1], 10)
		const x = parseInt(parts[2], 10)
		const y = parseInt(parts[3], 10)
		if (isNaN(row) || isNaN(x) || isNaN(y)) return null
		return { kind, cell: { row, col: 0 }, x, y }
	}

	return null
}

function serializeContextMenu(menu: ContextMenuValue): string {
	const { kind, cell, x, y } = menu
	if (kind === 'cell') return `cell:${cell.row}:${cell.col}:${x}:${y}`
	return `row:${cell.row}:${x}:${y}`
}

function parseSelectedCells(value: string | null): Set<string> {
	const cells = new Set<string>()
	if (!value || value === 'truncated') return cells
	for (const pair of value.split(',')) {
		const cell = parseCellPosition(pair)
		if (cell) cells.add(`${cell.row}:${cell.col}`)
	}
	return cells
}

function serializeSelectedCells(cells: Set<string>): string | null {
	if (cells.size === 0) return null
	if (cells.size > MAX_SERIALIZED_CELLS) return 'truncated'
	return Array.from(cells).join(',')
}

/**
 * @name readStudioUrlState
 * @description Parses the data grid's deep-link state (focused cell, selected
 * row and cells, open context menu, draft row) from the address bar. Read on
 * demand: nothing subscribes to the URL, so a URL write never re-renders the
 * studio.
 *
 * @example
 * const { selectedRow } = readStudioUrlState()
 */
export function readStudioUrlState(): StudioUrlState {
	return {
		focusedCell: parseCellPosition(readUrlParam('focusedCell')),
		selectedRow: parseInteger(readUrlParam('selectedRow')),
		selectedCells: parseSelectedCells(readUrlParam('selectedCells')),
		contextMenu: parseContextMenu(readUrlParam('contextMenu')),
		addRecordMode: readUrlParam('addRecordMode') === 'true',
		addRecordIndex: parseInteger(readUrlParam('addRecordIndex'))
	}
}

/**
 * @name writeStudioUrlState
 * @description Writes part of the data grid's deep-link state to the address
 * bar. Empty values remove their parameter. The write is coalesced and applied
 * off the interaction's frame by `writeUrlParams`.
 *
 * @example
 * writeStudioUrlState({ selectedRow: 3, focusedCell: { row: 3, col: 1 } })
 */
export function writeStudioUrlState(patch: Partial<StudioUrlState>): void {
	const params: Record<string, string | null> = {}
	if ('focusedCell' in patch) {
		const cell = patch.focusedCell
		params.focusedCell = cell ? `${cell.row}:${cell.col}` : null
	}
	if ('selectedRow' in patch) {
		const row = patch.selectedRow
		params.selectedRow = row === null || row === undefined ? null : String(row)
	}
	if (patch.selectedCells) {
		params.selectedCells = serializeSelectedCells(patch.selectedCells)
	}
	if ('contextMenu' in patch) {
		params.contextMenu = patch.contextMenu ? serializeContextMenu(patch.contextMenu) : null
	}
	if ('addRecordMode' in patch) {
		params.addRecordMode = patch.addRecordMode ? 'true' : null
	}
	if ('addRecordIndex' in patch) {
		const index = patch.addRecordIndex
		params.addRecordIndex = index === null || index === undefined ? null : String(index)
	}
	writeUrlParams(params)
}

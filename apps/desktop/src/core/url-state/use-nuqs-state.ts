import { useQueryStates, parseAsInteger } from 'nuqs'
import { useCallback } from 'react'

type CellPosition = {
	row: number
	col: number
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

function serializeCellPosition(cell: CellPosition | null): string | null {
	if (!cell) return null
	return `${cell.row}:${cell.col}`
}

const cellParser = {
	parse: (value: string | null): CellPosition | null => parseCellPosition(value),
	serialize: (cell: CellPosition | null): string | null => serializeCellPosition(cell)
}

type ContextMenuState = {
	kind: 'cell' | 'row'
	cell: CellPosition
	x: number
	y: number
} | null

function parseContextMenu(value: string | null): ContextMenuState {
	if (!value) return null
	const parts = value.split(':')
	if (parts.length < 4) return null

	const kind = parts[0]
	if (kind !== 'cell' && kind !== 'row') return null

	if (kind === 'cell') {
		if (parts.length !== 5) return null
		const row = parseInt(parts[1], 10)
		const col = parseInt(parts[2], 10)
		const x = parseInt(parts[3], 10)
		const y = parseInt(parts[4], 10)
		if (isNaN(row) || isNaN(col) || isNaN(x) || isNaN(y)) return null
		return { kind, cell: { row, col }, x, y }
	} else {
		if (parts.length !== 4) return null
		const row = parseInt(parts[1], 10)
		const x = parseInt(parts[2], 10)
		const y = parseInt(parts[3], 10)
		if (isNaN(row) || isNaN(x) || isNaN(y)) return null
		return { kind, cell: { row, col: 0 }, x, y }
	}
}

function serializeContextMenu(ctx: ContextMenuState): string | null {
	if (!ctx) return null
	const { kind, cell, x, y } = ctx
	if (kind === 'cell') {
		return `cell:${cell.row}:${cell.col}:${x}:${y}`
	}
	return `row:${cell.row}:${x}:${y}`
}

const contextMenuParser = {
	parse: (value: string | null): ContextMenuState => parseContextMenu(value),
	serialize: (ctx: ContextMenuState | null): string | null =>
		ctx == null ? null : serializeContextMenu(ctx)
}

const MAX_SERIALIZED_CELLS = 50

function parseSelectedCells(value: string | null): Set<string> {
	if (!value || value === 'truncated') return new Set<string>()
	const cells = new Set<string>()
	if (!value) return cells

	const pairs = value.split(',')
	for (const pair of pairs) {
		const cell = parseCellPosition(pair)
		if (cell) {
			cells.add(`${cell.row}:${cell.col}`)
		}
	}
	return cells
}

function serializeSelectedCells(cells: Set<string>): string | null {
	if (!cells || cells.size === 0) return null
	if (cells.size > MAX_SERIALIZED_CELLS) return 'truncated'
	return Array.from(cells).join(',')
}

const selectedCellsParser = {
	parse: (value: string | null): Set<string> => parseSelectedCells(value),
	serialize: (cells: Set<string> | null): string | null =>
		cells == null ? null : serializeSelectedCells(cells)
}

export type UrlState = {
	focusedCell: CellPosition | null
	selectedRow: number | null
	selectedCells: Set<string>
	contextMenu: ContextMenuState
	addRecordMode: boolean
	addRecordIndex: number | null
}

export function useNuqsState() {
	const [state, setState] = useQueryStates({
		focusedCell: cellParser,
		selectedRow: parseAsInteger.withDefault(null),
		selectedCells: selectedCellsParser,
		contextMenu: contextMenuParser,
		addRecordMode: {
			parse: (value: string | null): boolean => value === 'true',
			serialize: (value: boolean): string | null => (value ? 'true' : null)
		},
		addRecordIndex: parseAsInteger.withDefault(null)
	})

	const setFocusedCell = useCallback(
		function (cell: CellPosition | null) {
			setState({ focusedCell: cell })
		},
		[setState]
	)

	const setSelectedRow = useCallback(
		function (row: number | null) {
			setState({ selectedRow: row })
		},
		[setState]
	)

	const setSelectedCells = useCallback(
		function (cells: Set<string>) {
			setState({ selectedCells: cells })
		},
		[setState]
	)

	const setContextMenu = useCallback(
		function (ctx: ContextMenuState) {
			setState({ contextMenu: ctx })
		},
		[setState]
	)

	const setAddRecordMode = useCallback(
		function (enabled: boolean, index?: number | null) {
			setState({
				addRecordMode: enabled,
				addRecordIndex: index ?? null
			})
		},
		[setState]
	)

	return {
		urlState: {
			focusedCell: state.focusedCell,
			selectedRow: state.selectedRow,
			selectedCells: state.selectedCells ?? new Set<string>(),
			contextMenu: state.contextMenu,
			addRecordMode: state.addRecordMode,
			addRecordIndex: state.addRecordIndex
		},
		setFocusedCell,
		setSelectedRow,
		setSelectedCells,
		setContextMenu,
		setAddRecordMode
	}
}
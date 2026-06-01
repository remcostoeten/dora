export type EditingCell = {
	rowIndex: number
	columnName: string
}

export type CellPosition = {
	row: number
	col: number
}

export type ContextMenuState = {
	kind: 'cell' | 'row'
	cell: { row: number; col: number }
	x: number
	y: number
} | null

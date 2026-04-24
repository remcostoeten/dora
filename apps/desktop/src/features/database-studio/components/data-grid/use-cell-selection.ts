import { useMemo, useState } from 'react'

export function useCellSelection(
	externalSelectedCells?: Set<string>,
	onCellSelectionChange?: (cells: Set<string>) => void
) {
	const [internalSelectedCells, setInternalSelectedCells] = useState<Set<string>>(new Set())
	const selectedCellsSet = externalSelectedCells ?? internalSelectedCells
	const selectedCellsByRow = useMemo(() => {
		const byRow = new Map<number, Set<number>>()
		for (const key of selectedCellsSet) {
			const [rowPart, colPart] = key.split(':')
			const rowIndex = Number(rowPart)
			const colIndex = Number(colPart)
			if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) continue
			const current = byRow.get(rowIndex)
			if (current) {
				current.add(colIndex)
			} else {
				byRow.set(rowIndex, new Set([colIndex]))
			}
		}
		return byRow
	}, [selectedCellsSet])

	function updateCellSelection(cells: Set<string>) {
		if (onCellSelectionChange) {
			onCellSelectionChange(cells)
		} else {
			setInternalSelectedCells(cells)
		}
	}

	return { selectedCellsSet, selectedCellsByRow, updateCellSelection }
}

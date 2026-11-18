import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ColumnDefinition, SortDescriptor } from '../../types'
import {
	describeCellSelection,
	describeFocusedCell,
	describeFocusedHeader,
	describeRowSelection
} from './grid-announce'
import { CellPosition } from './types'

export type GridLiveMessage = {
	id: number
	text: string
}

type Props = {
	columns: ColumnDefinition[]
	focusedCell: CellPosition | null
	isHeaderFocused: boolean
	liveMessage?: GridLiveMessage
	masked: boolean
	rowNumberOffset: number
	rows: Record<string, unknown>[]
	selectedCellCount: number
	selectedRowCount: number
	sort?: SortDescriptor
}

export function useGridAnnouncer({
	columns,
	focusedCell,
	isHeaderFocused,
	liveMessage,
	masked,
	rowNumberOffset,
	rows,
	selectedCellCount,
	selectedRowCount,
	sort
}: Props) {
	const [message, setMessage] = useState('')
	const previousRowCountRef = useRef(selectedRowCount)

	const focusText = useMemo(() => {
		if (!focusedCell) return null
		const column = columns[focusedCell.col]
		if (!column) return null
		if (isHeaderFocused) {
			return describeFocusedHeader(
				column.name,
				sort?.column === column.name ? sort.direction : undefined
			)
		}
		const row = rows[focusedCell.row]
		if (!row) return null
		return describeFocusedCell({
			column,
			rowNumber: rowNumberOffset + focusedCell.row + 1,
			value: masked ? undefined : row[column.name],
			masked
		})
	}, [columns, focusedCell, isHeaderFocused, masked, rowNumberOffset, rows, sort])

	useEffect(() => {
		if (focusText) setMessage(focusText)
	}, [focusText])

	useEffect(() => {
		const text = describeCellSelection(selectedCellCount)
		if (text) setMessage(text)
	}, [selectedCellCount])

	useEffect(() => {
		const text = describeRowSelection(selectedRowCount, previousRowCountRef.current)
		previousRowCountRef.current = selectedRowCount
		if (text) setMessage(text)
	}, [selectedRowCount])

	useEffect(() => {
		if (liveMessage) setMessage(liveMessage.text)
	}, [liveMessage])

	const announce = useCallback((text: string) => setMessage(text), [])

	return { message, announce }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

export const MIN_COLUMN_WIDTH = 100
export const DEFAULT_COLUMN_WIDTH = 150

export function useColumnResize() {
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
	const [resizingColumn, setResizingColumn] = useState<string | null>(null)
	const startXRef = useRef(0)
	const startWidthRef = useRef(0)

	const getColumnWidth = useCallback(
		function (colName: string) {
			return columnWidths[colName]
		},
		[columnWidths]
	)

	const handleResizeStart = useCallback(
		function (e: React.MouseEvent, columnName: string) {
			e.preventDefault()
			e.stopPropagation()

			setResizingColumn(columnName)
			startXRef.current = e.clientX

			const currentWidth = columnWidths[columnName]
			if (typeof currentWidth === 'number') {
				startWidthRef.current = currentWidth
			} else {
				const th = (e.target as HTMLElement).closest('th')
				startWidthRef.current = th?.getBoundingClientRect().width ?? DEFAULT_COLUMN_WIDTH
			}
		},
		[columnWidths]
	)

	useEffect(
		function resizeColumnWhileDragging() {
			if (!resizingColumn) return

			const handleMouseMove = function (e: MouseEvent) {
				const delta = e.clientX - startXRef.current
				const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta)

				setColumnWidths(function (prev) {
					return {
						...prev,
						[resizingColumn]: newWidth
					}
				})
			}

			const handleMouseUp = function () {
				setResizingColumn(null)
			}

			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)

			return function () {
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
			}
		},
		[resizingColumn]
	)

	const handleResizeDoubleClick = useCallback(function (
		e: React.MouseEvent,
		columnName: string,
		columnType?: string
	) {
		e.preventDefault()
		e.stopPropagation()

		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			setColumnWidths(function (prev) {
				const next = { ...prev }
				delete next[columnName]
				return next
			})
			return
		}

		ctx.font = '12px Inter, system-ui, sans-serif'
		const nameWidth = ctx.measureText(columnName).width

		let typeWidth = 0
		if (columnType && columnType !== 'unknown') {
			ctx.font = "10px 'JetBrains Mono', monospace"
			typeWidth = ctx.measureText(columnType).width
		}

		const sortIconWidth = 16
		const padding = 32
		const gap = typeWidth > 0 ? 8 : 0
		const optimalWidth = Math.ceil(nameWidth + typeWidth + sortIconWidth + padding + gap)
		const finalWidth = Math.max(MIN_COLUMN_WIDTH, optimalWidth)

		setColumnWidths(function (prev) {
			return { ...prev, [columnName]: finalWidth }
		})
	}, [])

	return {
		resizingColumn,
		getColumnWidth,
		handleResizeStart,
		handleResizeDoubleClick
	}
}

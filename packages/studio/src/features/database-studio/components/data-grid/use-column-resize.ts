import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useWorkspaceState } from '@studio/core/workspace-state'
import { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH, getResizedWidth } from './column-width'

export { DEFAULT_COLUMN_WIDTH, MIN_COLUMN_WIDTH }

function measureHeaderWidth(columnName: string, columnType?: string): number | null {
	const canvas = document.createElement('canvas')
	const ctx = canvas.getContext('2d')
	if (!ctx) return null

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
	return Math.max(MIN_COLUMN_WIDTH, optimalWidth)
}

export function useColumnResize(workspaceStateKey: string) {
	const [columnWidths, setColumnWidths] = useWorkspaceState(
		`${workspaceStateKey}:column-widths`,
		() => {
			return {} as Record<string, number>
		}
	)
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

			let latestWidth = startWidthRef.current
			let frame = 0

			const commitWidth = function () {
				frame = 0
				setColumnWidths(function (prev) {
					if (prev[resizingColumn] === latestWidth) return prev
					return {
						...prev,
						[resizingColumn]: latestWidth
					}
				})
			}

			const handleMouseMove = function (e: MouseEvent) {
				const delta = e.clientX - startXRef.current
				latestWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta)
				if (!frame) frame = requestAnimationFrame(commitWidth)
			}

			const handleMouseUp = function () {
				if (frame) {
					cancelAnimationFrame(frame)
					commitWidth()
				}
				setResizingColumn(null)
			}

			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)

			return function () {
				cancelAnimationFrame(frame)
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
			}
		},
		[resizingColumn]
	)

	const autoFitColumn = useCallback(
		function (columnName: string, columnType?: string) {
			const fittedWidth = measureHeaderWidth(columnName, columnType)
			setColumnWidths(function (prev) {
				if (fittedWidth !== null) return { ...prev, [columnName]: fittedWidth }
				const next = { ...prev }
				delete next[columnName]
				return next
			})
		},
		[setColumnWidths]
	)

	const handleResizeDoubleClick = useCallback(
		function (e: React.MouseEvent, columnName: string, columnType?: string) {
			e.preventDefault()
			e.stopPropagation()
			autoFitColumn(columnName, columnType)
		},
		[autoFitColumn]
	)

	const resizeColumnBy = useCallback(
		function (columnName: string, delta: number) {
			setColumnWidths(function (prev) {
				const current = prev[columnName] ?? DEFAULT_COLUMN_WIDTH
				return { ...prev, [columnName]: getResizedWidth(current, delta) }
			})
		},
		[setColumnWidths]
	)

	return {
		resizingColumn,
		getColumnWidth,
		handleResizeStart,
		handleResizeDoubleClick,
		autoFitColumn,
		resizeColumnBy
	}
}

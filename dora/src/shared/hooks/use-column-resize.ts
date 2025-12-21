"use client"

import type React from "react"

import { useState, useCallback, useRef, useEffect } from "react"

export type ColumnWidths = Record<string, number>

type UseColumnResizeOpts = {
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
}

export function useColumnResize({ minWidth = 60, maxWidth = 600, defaultWidth = 150 }: UseColumnResizeOpts = {}) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>({})
  const [resizing, setResizing] = useState<string | null>(null)
  const startRef = useRef<{ x: number; width: number }>({ x: 0, width: 0 })

  const getColumnWidth = useCallback(
    (columnName: string, isPrimary = false): number => {
      if (columnWidths[columnName] !== undefined) {
        return columnWidths[columnName]
      }
      return isPrimary ? 80 : defaultWidth
    },
    [columnWidths, defaultWidth],
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnName: string) => {
      e.preventDefault()
      e.stopPropagation()
      setResizing(columnName)
      const currentWidth = columnWidths[columnName] ?? defaultWidth
      startRef.current = { x: e.clientX, width: currentWidth }
    },
    [columnWidths, defaultWidth],
  )

  const handleAutoFit = useCallback(
    (columnName: string, contentWidths: number[]) => {
      if (contentWidths.length === 0) return

      // Find the maximum content width plus padding
      const maxContentWidth = Math.max(...contentWidths)
      const newWidth = Math.max(minWidth, Math.min(maxWidth, maxContentWidth + 24)) // 24px for padding

      setColumnWidths((prev) => ({
        ...prev,
        [columnName]: newWidth,
      }))
    },
    [minWidth, maxWidth],
  )

  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startRef.current.x
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startRef.current.width + delta))
      setColumnWidths((prev) => ({
        ...prev,
        [resizing]: newWidth,
      }))
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [resizing, minWidth, maxWidth])

  const resetColumnWidth = useCallback((columnName: string) => {
    setColumnWidths((prev) => {
      const next = { ...prev }
      delete next[columnName]
      return next
    })
  }, [])

  const resetAllColumnWidths = useCallback(() => {
    setColumnWidths({})
  }, [])

  return {
    columnWidths,
    resizing,
    getColumnWidth,
    handleResizeStart,
    handleAutoFit,
    resetColumnWidth,
    resetAllColumnWidths,
  }
}

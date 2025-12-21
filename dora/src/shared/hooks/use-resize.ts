"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"

type ResizeOpts = {
  min: number
  max: number
  initial: number
  onResize?: (size: number) => void
}

export function useResize({ min, max, initial, onResize }: ResizeOpts) {
  const [size, setSize] = useState(initial)
  const [isDragging, setIsDragging] = useState(false)
  const startRef = useRef({ x: 0, size: 0 })

  const handleStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startRef.current = { x: e.clientX, size }
    },
    [size],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - startRef.current.x
      const newSize = Math.max(min, Math.min(max, startRef.current.size + delta))
      setSize(newSize)
      onResize?.(newSize)
    }

    const handleEnd = () => setIsDragging(false)

    document.addEventListener("mousemove", handleMove)
    document.addEventListener("mouseup", handleEnd)

    return () => {
      document.removeEventListener("mousemove", handleMove)
      document.removeEventListener("mouseup", handleEnd)
    }
  }, [isDragging, min, max, onResize])

  return { size, isDragging, handleStart }
}

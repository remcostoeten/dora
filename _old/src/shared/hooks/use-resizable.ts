'use client'

import { useState, useCallback, useEffect, useRef } from 'react'


type Props = {
    direction?: 'horizontal' | 'vertical'
    storageKey?: string
    defaultSize?: number
    minSize?: number
    maxSize?: number
    shouldInverse?: boolean
    onResizeEnd?: (size: number) => void
    onResize?: (size: number) => void
}

export function useResizable({
    direction = 'horizontal',
    storageKey = 'sidebar-width',
    defaultSize = 340,
    minSize = 50,
    maxSize = 600,
    shouldInverse = false,
    onResizeEnd,
    onResize
}: Props = {}) {
    const [size, setSize] = useState(defaultSize)
    const [isResizing, setIsResizing] = useState(false)
    const startPosRef = useRef(0)
    const startSizeRef = useRef(0)

    // Load saved size from localStorage
    useEffect(() => {
        if (!storageKey) return
        const saved = localStorage.getItem(storageKey)
        if (saved) {
            const parsed = parseInt(saved, 10)
            if (!isNaN(parsed) && parsed >= minSize && parsed <= maxSize) {
                setSize(parsed)
            }
        }
    }, [storageKey, minSize, maxSize])

    // Save size to localStorage
    useEffect(() => {
        if (!isResizing && storageKey) {
            localStorage.setItem(storageKey, String(size))
        }
    }, [size, isResizing, storageKey])

    const startResizing = useCallback((e: React.MouseEvent, initialSize?: number) => {
        e.preventDefault()
        setIsResizing(true)
        startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY

        if (initialSize !== undefined) {
            startSizeRef.current = initialSize
            setSize(initialSize)
        } else {
            startSizeRef.current = size
        }
    }, [size, direction])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
            // For vertical bottom pane (VS Code style), dragging UP increases height if we measure from bottom,
            // but here we likely measure the top pane or bottom pane height naturally.
            // If dragging a separator between Top (Flex) and Bottom (Fixed Height):
            // Moving mouse DOWN (positive delta) -> Decreases Bottom Pane Height (if separator is at top of bottom pane)
            // Wait, usually the separator is ABOVE the bottom pane.
            // Dragging DOWN = decreasing height. Dragging UP = increasing height.
            // Delta = current - start. 
            // If we are resizing a sidebar on the LEFT: Moving RIGHT (positive) -> Increases width.

            // Let's assume standard behavior:
            // Horizontal: resizing right edge of an element -> delta adds to size.
            // Vertical: resizing bottom edge of an element -> delta adds to size.
            // Vertical: resizing top edge of an element (like bottom pane) -> delta subtracts from size (dy < 0 means mouse moved up -> size increases).

            // We need a way to control the "polarity" or let the implementation handle it?
            // Simplest is to assume "Standard" (resize handle is at the end of the element provided).
            // But for bottom pane, the handle is at the START (top).

            // Let's keep it simple: delta = current - start.
            // The user of the hook can invert it if needed or we add a 'reverse' option?
            // Adding 'reverse' option is cleaner.

            const delta = currentPos - startPosRef.current
            const adjustedDelta = shouldInverse ? -delta : delta

            const newSize = Math.min(maxSize, Math.max(minSize, startSizeRef.current + adjustedDelta))
            setSize(newSize)
            onResize?.(newSize)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            onResizeEnd?.(size)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        // Add resize cursor to body during resize
        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing, direction, maxSize, minSize, onResize, onResizeEnd, size])

    return {
        size,
        isResizing,
        startResizing,
        minSize,
        maxSize,
        setSize
    }
}

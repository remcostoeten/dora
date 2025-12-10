'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'sidebar-width'
const DEFAULT_WIDTH = 340
const MIN_WIDTH = 200
const MAX_WIDTH = 600

export function useResizable() {
    const [width, setWidth] = useState(DEFAULT_WIDTH)
    const [isResizing, setIsResizing] = useState(false)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)

    // Load saved width from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            const parsed = parseInt(saved, 10)
            if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
                setWidth(parsed)
            }
        }
    }, [])

    // Save width to localStorage
    useEffect(() => {
        if (!isResizing) {
            localStorage.setItem(STORAGE_KEY, String(width))
        }
    }, [width, isResizing])

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
        startXRef.current = e.clientX
        startWidthRef.current = width
    }, [width])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startXRef.current
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
            setWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        // Add resize cursor to body during resize
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing])

    return {
        width,
        isResizing,
        startResizing,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
    }
}

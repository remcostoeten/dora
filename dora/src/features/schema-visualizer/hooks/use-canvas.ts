"use client"

import { useState, useCallback, useRef, useEffect, type RefObject, type WheelEvent, type MouseEvent } from "react"
import type { CanvasState, Position } from "../types"

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

export function useCanvas(containerRef: RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState<CanvasState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })

  const isPanning = useRef(false)
  const lastMousePos = useRef<Position>({ x: 0, y: 0 })

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setState((prev) => ({
        ...prev,
        zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom + delta)),
      }))
    } else {
      // Pan
      setState((prev) => ({
        ...prev,
        panX: prev.panX - e.deltaX,
        panY: prev.panY - e.deltaY,
      }))
    }
  }, [])

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning.current = true
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning.current) return

    const deltaX = e.clientX - lastMousePos.current.x
    const deltaY = e.clientY - lastMousePos.current.y

    setState((prev) => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY,
    }))

    lastMousePos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const zoomIn = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP),
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setState((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP),
    }))
  }, [])

  const resetView = useCallback(() => {
    setState({ zoom: 1, panX: 0, panY: 0 })
  }, [])

  const fitToScreen = useCallback(() => {
    // TODO: Calculate bounding box of all nodes and fit
    resetView()
  }, [resetView])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isPanning.current = false
    }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

  return {
    state,
    handlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
    },
    controls: {
      zoomIn,
      zoomOut,
      resetView,
      fitToScreen,
    },
  }
}

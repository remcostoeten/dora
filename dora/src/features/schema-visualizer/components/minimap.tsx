"use client"

import type React from "react"

import { memo, useMemo } from "react"
import type { SchemaNode, CanvasState } from "../types"

type MinimapProps = {
  nodes: SchemaNode[]
  canvasState: CanvasState
  viewportWidth: number
  viewportHeight: number
  onViewportChange: (x: number, y: number) => void
}

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 100
const NODE_WIDTH = 240
const NODE_HEIGHT = 150

export const Minimap = memo(function Minimap({
  nodes,
  canvasState,
  viewportWidth,
  viewportHeight,
  onViewportChange,
}: MinimapProps) {
  const { bounds, scale } = useMemo(() => {
    if (nodes.length === 0) {
      return {
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 800 },
        scale: 0.1,
      }
    }

    const minX = Math.min(...nodes.map((n) => n.position.x)) - 100
    const minY = Math.min(...nodes.map((n) => n.position.y)) - 100
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_WIDTH)) + 100
    const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_HEIGHT)) + 100

    const width = maxX - minX
    const height = maxY - minY
    const scale = Math.min(MINIMAP_WIDTH / width, MINIMAP_HEIGHT / height)

    return { bounds: { minX, minY, maxX, maxY }, scale }
  }, [nodes])

  const viewportRect = useMemo(() => {
    const width = (viewportWidth / canvasState.zoom) * scale
    const height = (viewportHeight / canvasState.zoom) * scale
    const x = (-canvasState.panX / canvasState.zoom - bounds.minX) * scale
    const y = (-canvasState.panY / canvasState.zoom - bounds.minY) * scale

    return { x, y, width, height }
  }, [canvasState, bounds, scale, viewportWidth, viewportHeight])

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale + bounds.minX
    const y = (e.clientY - rect.top) / scale + bounds.minY
    onViewportChange(-x * canvasState.zoom, -y * canvasState.zoom)
  }

  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-md border bg-card/80 backdrop-blur-sm p-1.5">
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} className="cursor-crosshair" onClick={handleClick}>
        {/* Background */}
        <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="oklch(0.09 0.002 260)" rx={4} />

        {/* Nodes */}
        {nodes.map((node) => (
          <rect
            key={node.id}
            x={(node.position.x - bounds.minX) * scale}
            y={(node.position.y - bounds.minY) * scale}
            width={NODE_WIDTH * scale}
            height={(36 + node.columns.length * 28) * scale}
            fill="oklch(0.2 0.002 260)"
            stroke="oklch(0.3 0.002 260)"
            strokeWidth={0.5}
            rx={2}
          />
        ))}

        {/* Viewport indicator */}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={Math.max(viewportRect.width, 20)}
          height={Math.max(viewportRect.height, 15)}
          fill="oklch(0.72 0.14 190 / 0.15)"
          stroke="oklch(0.72 0.14 190)"
          strokeWidth={1}
          rx={2}
        />
      </svg>
    </div>
  )
})

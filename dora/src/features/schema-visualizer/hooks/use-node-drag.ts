"use client"

import { useState, useCallback, useRef, type MouseEvent } from "react"
import type { Position, SchemaNode } from "../types"

export function useNodeDrag(nodes: SchemaNode[], onNodesChange: (nodes: SchemaNode[]) => void, zoom: number) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOffset = useRef<Position>({ x: 0, y: 0 })

  const handleDragStart = useCallback(
    (e: MouseEvent, nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      setDraggingId(nodeId)
      dragOffset.current = {
        x: e.clientX / zoom - node.position.x,
        y: e.clientY / zoom - node.position.y,
      }
      e.stopPropagation()
    },
    [nodes, zoom],
  )

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingId) return

      const newX = e.clientX / zoom - dragOffset.current.x
      const newY = e.clientY / zoom - dragOffset.current.y

      const updatedNodes = nodes.map((node) =>
        node.id === draggingId ? { ...node, position: { x: newX, y: newY } } : node,
      )
      onNodesChange(updatedNodes)
    },
    [draggingId, nodes, onNodesChange, zoom],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
  }, [])

  return {
    draggingId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  }
}

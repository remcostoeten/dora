"use client"

import { memo, useMemo } from "react"
import type { SchemaNode, SchemaRelation } from "../types"

type RelationLineProps = {
  relation: SchemaRelation
  nodes: SchemaNode[]
  isHighlighted: boolean
}

const NODE_WIDTH = 240
const ROW_HEIGHT = 28
const HEADER_HEIGHT = 36

export const RelationLine = memo(function RelationLine({ relation, nodes, isHighlighted }: RelationLineProps) {
  const path = useMemo(() => {
    const sourceNode = nodes.find((n) => n.name === relation.sourceTable)
    const targetNode = nodes.find((n) => n.name === relation.targetTable)

    if (!sourceNode || !targetNode) return null

    const sourceColIndex = sourceNode.columns.findIndex((c) => c.name === relation.sourceColumn)
    const targetColIndex = targetNode.columns.findIndex((c) => c.name === relation.targetColumn)

    if (sourceColIndex === -1 || targetColIndex === -1) return null

    // Calculate connection points
    const sourceX = sourceNode.position.x + NODE_WIDTH
    const sourceY = sourceNode.position.y + HEADER_HEIGHT + sourceColIndex * ROW_HEIGHT + ROW_HEIGHT / 2

    const targetX = targetNode.position.x
    const targetY = targetNode.position.y + HEADER_HEIGHT + targetColIndex * ROW_HEIGHT + ROW_HEIGHT / 2

    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const controlOffset = Math.min(Math.max(dist * 0.3, 60), 150)

    return {
      d: `M ${sourceX} ${sourceY} 
          C ${sourceX + controlOffset} ${sourceY}, 
            ${targetX - controlOffset} ${targetY}, 
            ${targetX} ${targetY}`,
      sourcePoint: { x: sourceX, y: sourceY },
      targetPoint: { x: targetX, y: targetY },
    }
  }, [relation, nodes])

  if (!path) return null

  const strokeColor = isHighlighted ? "rgba(45, 212, 191, 0.9)" : "rgba(94, 234, 212, 0.35)"
  const dotColor = isHighlighted ? "rgba(45, 212, 191, 1)" : "rgba(94, 234, 212, 0.5)"

  return (
    <g className="pointer-events-none">
      <style>
        {`
          @keyframes dashFlow {
            from { stroke-dashoffset: 24; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>

      {/* Line glow effect for highlighted state */}
      {isHighlighted && (
        <path
          d={path.d}
          fill="none"
          stroke="rgba(45, 212, 191, 0.2)"
          strokeWidth={8}
          strokeLinecap="round"
          style={{ filter: "blur(4px)" }}
        />
      )}

      {/* Main dashed line with animation */}
      <path
        d={path.d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 2 : 1.5}
        strokeLinecap="round"
        strokeDasharray={isHighlighted ? "0" : "6 6"}
        style={{
          animation: isHighlighted ? "none" : "dashFlow 1s linear infinite",
          transition: "stroke 0.2s ease, stroke-width 0.2s ease",
        }}
      />

      {/* Source connection dot */}
      <circle
        cx={path.sourcePoint.x}
        cy={path.sourcePoint.y}
        r={isHighlighted ? 5 : 4}
        fill={dotColor}
        stroke="rgba(17, 24, 39, 0.8)"
        strokeWidth={2}
        style={{ transition: "all 0.2s ease" }}
      />

      {/* Target connection dot with arrow indicator */}
      <circle
        cx={path.targetPoint.x}
        cy={path.targetPoint.y}
        r={isHighlighted ? 5 : 4}
        fill={dotColor}
        stroke="rgba(17, 24, 39, 0.8)"
        strokeWidth={2}
        style={{ transition: "all 0.2s ease" }}
      />

      {/* Small inner dot for source (hollow effect) */}
      <circle
        cx={path.sourcePoint.x}
        cy={path.sourcePoint.y}
        r={isHighlighted ? 2 : 1.5}
        fill="rgba(17, 24, 39, 0.9)"
      />
    </g>
  )
})

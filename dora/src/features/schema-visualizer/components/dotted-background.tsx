"use client"

import { memo } from "react"

type DottedBackgroundProps = {
  panX: number
  panY: number
  zoom: number
}

export const DottedBackground = memo(function DottedBackground({ panX, panY, zoom }: DottedBackgroundProps) {
  const dotSize = 1
  const gridSize = 20 * zoom
  const offsetX = (panX % gridSize) + gridSize
  const offsetY = (panY % gridSize) + gridSize

  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none">
      <defs>
        <pattern
          id="dotPattern"
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <circle cx={gridSize / 2} cy={gridSize / 2} r={dotSize} fill="oklch(0.25 0.002 260)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dotPattern)" />
    </svg>
  )
})

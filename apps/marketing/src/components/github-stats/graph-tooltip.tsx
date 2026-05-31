'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { CommitDataPoint } from './commit-graph'
import { ACCENT_COLOR } from './constants'

interface GraphTooltipProps {
    data: CommitDataPoint | null
    position: { x: number; y: number } | null
    containerRef: React.RefObject<HTMLDivElement | null>
    accentColor?: string
}

export function GraphTooltip({
    data,
    position,
    containerRef,
    accentColor = ACCENT_COLOR
}: GraphTooltipProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!data || !position || !mounted || !containerRef.current) return null

    const rect = containerRef.current.getBoundingClientRect()
    const tooltipX = rect.left + position.x
    const tooltipY = rect.top + position.y - 12

    return createPortal(
        <div
            className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{
                left: tooltipX,
                top: tooltipY
            }}
        >
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-3 py-2 text-xs whitespace-nowrap shadow-xl backdrop-blur-sm">
                <div className="text-[#6a6a6a] mb-0.5">{data.date}</div>
                <div className="font-medium" style={{ color: accentColor }}>
                    {data.commits} commit{data.commits !== 1 ? 's' : ''}
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-[#2a2a2a] flex items-center gap-1.5 text-[10px] text-[#4a4a4a]">
                    <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[9px] font-mono text-[#6a6a6a]">
                        click
                    </kbd>
                    <span>for details</span>
                </div>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-[#0f0f0f] border-r border-b border-[#2a2a2a]" />
        </div>,
        document.body
    )
}

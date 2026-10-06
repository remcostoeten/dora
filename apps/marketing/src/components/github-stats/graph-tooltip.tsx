'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import type { CommitDataPoint } from './commit-graph'
import { ACCENT_COLOR } from './constants'

type TRetained = {
    data: CommitDataPoint
    position: { x: number; y: number }
}

interface Props {
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
}: Props) {
    const [mounted, setMounted] = useState(false)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const [retained, setRetained] = useState<TRetained | null>(null)
    const active = Boolean(data && position)

    useEffect(() => {
        if (!active || !data || !position) {
            setVisible(false)
            return
        }
        setRetained({ data, position })
        const frame = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(frame)
    }, [active, data, position])

    if (!retained || !mounted || !containerRef.current) return null

    const rect = containerRef.current.getBoundingClientRect()
    const tooltipX = rect.left + retained.position.x
    const tooltipY = rect.top + retained.position.y - 12

    return createPortal(
        <div
            className="graph-tooltip fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-full"
            data-visible={visible}
            style={{
                left: tooltipX,
                top: tooltipY
            }}
        >
            <div className="bg-surface-deep border border-line rounded-md px-3 py-2 text-xs whitespace-nowrap shadow-xl backdrop-blur-sm">
                <div className="text-ink-700 mb-0.5">{retained.data.date}</div>
                <div className="font-medium" style={{ color: accentColor }}>
                    {retained.data.commits} commit
                    {retained.data.commits !== 1 ? 's' : ''}
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-line flex items-center gap-1.5 text-[10px] text-line-bright">
                    <kbd className="px-1.5 py-0.5 bg-surface-elevated border border-line rounded text-[9px] font-mono text-ink-700">
                        click
                    </kbd>
                    <span>for details</span>
                </div>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-surface-deep border-r border-b border-line" />
        </div>,
        document.body
    )
}

'use client'

import { cn } from '@/core/utilities/cn'

type ResizeHandleProps = {
    onMouseDown: (e: React.MouseEvent) => void
    isResizing: boolean
}

export function ResizeHandle({ onMouseDown, isResizing }: ResizeHandleProps) {
    return (
        <div
            className={cn(
                'absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize',
                'transition-colors duration-150',
                'hover:bg-primary/30',
                isResizing && 'bg-primary/50'
            )}
            onMouseDown={onMouseDown}
        >
            {/* Wider hitzone for easier grabbing */}
            <div className="absolute -left-1 -right-1 inset-y-0" />
        </div>
    )
}

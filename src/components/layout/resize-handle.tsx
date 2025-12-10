'use client'

import { cn } from '@/core/utilities/cn'

type ResizeHandleProps = {
    onMouseDown: (e: React.MouseEvent) => void
    isResizing: boolean
    orientation?: 'vertical' | 'horizontal'
}

export function ResizeHandle({ onMouseDown, isResizing, orientation = 'vertical' }: ResizeHandleProps) {
    return (
        <div
            className={cn(
                'absolute z-10 transition-colors duration-150 hover:bg-primary/30',
                isResizing && 'bg-primary/50',
                orientation === 'vertical'
                    ? 'right-0 top-0 h-full w-1 cursor-col-resize'
                    : 'top-0 left-0 w-full h-1 cursor-row-resize',
            )}
            onMouseDown={onMouseDown}
        >
            {/* Wider hitzone for easier grabbing */}
            <div className={cn(
                "absolute",
                orientation === 'vertical'
                    ? "-left-1 -right-1 inset-y-0"
                    : "-top-1 -bottom-1 inset-x-0"
            )} />
        </div>
    )
}

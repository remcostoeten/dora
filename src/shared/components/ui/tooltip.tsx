'use client'

import * as React from 'react'
import { cn } from '@/core/utilities/cn'

interface Props {
  children: React.ReactNode
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  delay?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delay = 400,
  className,
}: Props) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const childRef = React.useRef<HTMLElement>(null)

  const getPosition = React.useCallback(() => {
    if (!childRef.current) return { x: 0, y: 0 }

    const rect = childRef.current.getBoundingClientRect()
    const tooltipHeight = 32 // Approximate height
    const tooltipWidth = 150 // Approximate width
    const gap = 8

    let x = 0
    let y = 0

    // Calculate position based on side
    switch (side) {
      case 'top':
        x = rect.left + rect.width / 2
        y = rect.top - gap - tooltipHeight
        break
      case 'bottom':
        x = rect.left + rect.width / 2
        y = rect.bottom + gap
        break
      case 'left':
        x = rect.left - gap - tooltipWidth
        y = rect.top + rect.height / 2
        break
      case 'right':
        x = rect.right + gap
        y = rect.top + rect.height / 2
        break
    }

    // Adjust alignment
    switch (align) {
      case 'start':
        if (side === 'top' || side === 'bottom') {
          x = rect.left
        } else {
          y = rect.top
        }
        break
      case 'end':
        if (side === 'top' || side === 'bottom') {
          x = rect.right
        } else {
          y = rect.bottom
        }
        break
      case 'center':
        // Already centered by default
        break
    }

    // Ensure tooltip stays within viewport
    const padding = 8
    x = Math.max(padding, Math.min(x - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding))
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipHeight - padding))

    return { x, y }
  }, [side, align])

  const showTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setPosition(getPosition())
      setIsVisible(true)
    }, delay)
  }, [delay, getPosition])

  const hideTooltip = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const clonedChild = React.cloneElement(children as React.ReactElement, {
    ref: childRef as any,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
  } as any)

  return (
    <>
      {clonedChild}
      {isVisible && (
        <div
          className={cn(
            // Base styles
            'fixed z-50 px-3 py-1.5 text-xs font-medium rounded-md',
            'pointer-events-none select-none',

            // Theme-aware colors with glass effect
            'bg-[var(--glass-bg)] border border-[var(--glass-border)]',
            'text-[var(--foreground)]',

            // Poppy animations
            'animate-in fade-in-0 zoom-in-95',
            'transition-all duration-200 ease-out',

            // Shadow for depth
            'shadow-lg shadow-[var(--shadow-lg)]',

            // Backdrop blur for glass effect
            'backdrop-blur-md',

            className
          )}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative">
            {content}
            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-md bg-[var(--primary)]/10 blur-sm" />
          </div>
        </div>
      )}
    </>
  )
}

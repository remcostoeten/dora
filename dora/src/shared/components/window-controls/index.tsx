"use client"

import type React from "react"

import { useCallback, useState, useEffect } from "react"
import { Minus, Square, X, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { isTauri } from "@/shared/utils/tauri"

// Tauri 2.0 window API types (will be available at runtime)
interface TauriWindow {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onResized: (handler: () => void) => Promise<() => void>
}

// Get window from Tauri 2.0 API
async function getTauriWindow(): Promise<TauriWindow | null> {
  if (!isTauri()) return null

  try {
    // Tauri 2.0 uses @tauri-apps/api/window
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    return getCurrentWindow() as unknown as TauriWindow
  } catch {
    console.warn("[v0] Tauri window API not available")
    return null
  }
}

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)

  // Check maximized state on mount and window resize
  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    async function setup() {
      const window = await getTauriWindow()
      if (!window) return

      // Initial state
      setIsMaximized(await window.isMaximized())

      // Listen for resize events to update maximized state
      unsubscribe = await window.onResized(async () => {
        setIsMaximized(await window.isMaximized())
      })
    }

    setup()

    return () => {
      unsubscribe?.()
    }
  }, [])

  const handleMinimize = useCallback(async () => {
    const window = await getTauriWindow()
    if (window) {
      await window.minimize()
    }
  }, [])

  const handleMaximize = useCallback(async () => {
    const window = await getTauriWindow()
    if (window) {
      await window.toggleMaximize()
      setIsMaximized(await window.isMaximized())
    }
  }, [])

  const handleClose = useCallback(async () => {
    const window = await getTauriWindow()
    if (window) {
      await window.close()
    }
  }, [])

  // Comment out Tauri check for development - uncomment for production
  // if (!isTauri()) return null

  return (
    <div className="flex items-center" role="group" aria-label="Window controls">
      <WindowButton onClick={handleMinimize} aria-label="Minimize window" variant="default">
        <Minus className="h-3 w-3" strokeWidth={1.5} />
      </WindowButton>

      <WindowButton
        onClick={handleMaximize}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        variant="default"
      >
        {isMaximized ? (
          <Maximize2 className="h-3 w-3" strokeWidth={1.5} />
        ) : (
          <Square className="h-2.5 w-2.5" strokeWidth={1.5} />
        )}
      </WindowButton>

      <WindowButton onClick={handleClose} aria-label="Close window" variant="close">
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </WindowButton>
    </div>
  )
}

interface WindowButtonProps {
  children: React.ReactNode
  onClick: () => void
  "aria-label": string
  variant: "default" | "close"
}

function WindowButton({ children, onClick, "aria-label": ariaLabel, variant }: WindowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex h-8 w-11 items-center justify-center transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
        variant === "close"
          ? "text-foreground/60 hover:bg-destructive hover:text-destructive-foreground"
          : "text-foreground/60 hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Database, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"
import { isTauri } from "@/shared/utils"

interface TopBarProps {
  connectionName?: string
  databaseName?: string
  status?: "connected" | "disconnected" | "connecting"
  isDemo?: boolean
  className?: string
}

export function TopBar({ connectionName, databaseName, status = "disconnected", isDemo, className }: TopBarProps) {
  // Check on client-side after hydration to avoid static build showing "Web Demo" in Tauri
  const [isWebDemo, setIsWebDemo] = useState(false)

  useEffect(() => {
    setIsWebDemo(!isTauri())
  }, [])

  return (
    <div className={cn("flex h-12 items-center justify-between border-b border-border bg-background px-4", className)}>
      {/* Left: Database breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Database className="h-4 w-4 text-muted-foreground" />
        {status === "connected" && connectionName ? (
          <>
            <span className="text-foreground/80">{connectionName}</span>
            {isDemo && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                DEMO
              </span>
            )}
            {databaseName && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-foreground">{databaseName}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">No database connected</span>
        )}
      </div>

      {/* Right: Connection status indicator & Theme Toggle */}
      <div className="flex items-center gap-4">
        {/* Web Demo indicator */}
        {isWebDemo && (
          <div className="flex items-center gap-1.5 rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-600 dark:text-blue-400">
            <Globe className="h-3 w-3" />
            <span>Web Demo</span>
          </div>
        )}
        <ThemeToggle />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div
            className={cn("h-2 w-2 rounded-full", {
              "bg-green-500": status === "connected",
              "bg-yellow-500": status === "connecting",
              "bg-red-500": status === "disconnected",
            })}
          />
          <span className="capitalize">{status}</span>
        </div>
      </div>
    </div>
  )
}

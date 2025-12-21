"use client"

import { Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"

interface TopBarProps {
  connectionName?: string
  databaseName?: string
  status?: "connected" | "disconnected" | "connecting"
  className?: string
}

export function TopBar({ connectionName, databaseName, status = "disconnected", className }: TopBarProps) {
  return (
    <div className={cn("flex h-12 items-center justify-between border-b border-border bg-card/30 px-4", className)}>
      {/* Left: Database breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Database className="h-4 w-4 text-muted-foreground" />
        {status === "connected" && connectionName ? (
          <>
            <span className="text-foreground/80">{connectionName}</span>
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

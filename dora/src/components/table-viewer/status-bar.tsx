"use client"
import type { CellChange, PaginationConfig } from "./types"

interface StatusBarProps {
  totalRows: number
  pendingChanges?: Map<string, CellChange>
  pagination?: PaginationConfig
  onApplyChanges?: () => void
  onDiscardChanges?: () => void
}

export function StatusBar({ totalRows, pendingChanges, pagination, onApplyChanges, onDiscardChanges }: StatusBarProps) {
  const hasPendingChanges = pendingChanges && pendingChanges.size > 0

  const displayTotal = pagination?.total || totalRows

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/50 bg-card/50 px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="tabular-nums">{displayTotal.toLocaleString()} rows</span>
        {hasPendingChanges && (
          <div className="flex items-center gap-3">
            <span className="font-medium text-amber-400">{pendingChanges.size} pending</span>
            <button
              onClick={onDiscardChanges}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Discard
            </button>
            <button
              onClick={onApplyChanges}
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              Apply changes
            </button>
          </div>
        )}
      </div>
      <span className="text-muted-foreground/50">↑↓←→ navigate · Enter edit · Tab next · Esc close</span>
    </div>
  )
}

"use client"

import type { CellChange, PageConfig } from "@/shared/types"

type Props = {
  totalRows: number
  pendingChanges?: Map<string, CellChange>
  pagination?: PageConfig
  onApplyChanges?: () => void
  onDiscardChanges?: () => void
  lastQuerySql?: string
  lastQueryTime?: number
}

export function StatusBar({
  totalRows,
  pendingChanges,
  onApplyChanges,
  onDiscardChanges,
  lastQuerySql,
  lastQueryTime,
}: Props) {
  const hasPending = pendingChanges && pendingChanges.size > 0

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/50 bg-card/50 px-3 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="tabular-nums">{totalRows} rows</span>
        {hasPending && (
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

      <div className="flex items-center gap-4 overflow-hidden">
        {lastQuerySql && (
          <div className="flex max-w-[400px] items-center gap-2 overflow-hidden" title={lastQuerySql}>
            {lastQueryTime !== undefined && (
              <span className="shrink-0 font-mono text-xs text-primary/70">
                {lastQueryTime < 1 ? "<1ms" : `${lastQueryTime.toFixed(0)}ms`}
              </span>
            )}
            <span className="truncate font-mono text-[10px] opacity-70">{lastQuerySql}</span>
          </div>
        )}
        <span className="shrink-0 text-muted-foreground/50">
          ↑↓←→ navigate · Enter edit · Tab next · Esc close
        </span>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { X, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CellInfo, CellChange } from "@/shared/types"
import { cn } from "@/shared/utils"

type Props = {
  cell: CellInfo
  pendingChanges: Map<string, CellChange>
  onClose: () => void
  onCellChange: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
}

export function InfoPanel({ cell, pendingChanges, onClose, onCellChange }: Props) {
  const [copied, setCopied] = useState(false)

  const key = `${cell.rowIndex}:${cell.columnName}`
  const pendingChange = pendingChanges.get(key)
  const currentValue = pendingChange ? pendingChange.newValue : cell.value
  const isDirty = !!pendingChange

  const [editValue, setEditValue] = useState(currentValue === "NULL" ? "" : currentValue)

  useEffect(() => {
    const val = pendingChange ? pendingChange.newValue : cell.value
    setEditValue(val === "NULL" ? "" : val)
  }, [cell.rowIndex, cell.columnName, pendingChange, cell.value])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleChange = (value: string) => {
    setEditValue(value)
    const newVal = value === "" ? "NULL" : value
    onCellChange(cell.rowIndex, cell.columnName, cell.originalValue, newVal)
  }

  const handleReset = () => {
    setEditValue(cell.originalValue === "NULL" ? "" : cell.originalValue)
    onCellChange(cell.rowIndex, cell.columnName, cell.originalValue, cell.originalValue)
  }

  return (
    <div data-info-panel className="flex w-72 flex-col border-l border-border bg-card">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Inspector</span>
          {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Column</span>
              <span className="font-mono text-xs text-foreground">{cell.columnName}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Type</span>
              <span className="font-mono text-xs text-muted-foreground">{cell.type}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Row</span>
              <span className="font-mono text-xs text-muted-foreground">{cell.rowIndex + 1}</span>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Value</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <textarea
              value={editValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="NULL"
              className={cn(
                "min-h-[80px] w-full resize-none rounded-sm border bg-background p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring",
                isDirty ? "border-amber-500/50" : "border-border",
              )}
            />
            {isDirty && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-full text-xs text-muted-foreground"
                onClick={handleReset}
              >
                Reset to original
              </Button>
            )}
          </div>

          {isDirty && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Original</span>
                <pre className="overflow-x-auto rounded-sm bg-background p-2 font-mono text-[10px] text-muted-foreground/60">
                  {cell.originalValue}
                </pre>
              </div>
            </>
          )}

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">SQL Preview</span>
            <pre className="overflow-x-auto rounded-sm bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {`UPDATE table_name
SET ${cell.columnName} = ${editValue === "" ? "NULL" : `'${editValue}'`}
WHERE id = ${cell.rowIndex + 1};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { Play, Loader2, X, Maximize2, Minimize2, FlaskConical } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { useQuery } from "@/store"
import { MonacoEditor } from "./monaco-editor"
import { cn } from "@/lib/utils"

type Props = {
  onClose: () => void
}

export function QueryPanel({ onClose }: Props) {
  const { query, maximized, running, dryRun, hasErrors, setQuery, setMaximized, setDryRun, setHasErrors, runQuery } =
    useQuery()

  return (
    <div className="flex h-full flex-col border-b border-border bg-card">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">Query Editor</span>
          {hasErrors && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Syntax errors detected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-6 gap-1.5 px-2 text-xs transition-colors",
              dryRun && "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-400",
            )}
            onClick={() => setDryRun(!dryRun)}
            title="Dry Run - Validate query without executing"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Dry Run
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1.5 px-2 text-xs"
            onClick={runQuery}
            disabled={running || hasErrors}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {dryRun ? "Validate" : "Run Query"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setMaximized(!maximized)}
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose} title="Close">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MonacoEditor value={query} onChange={setQuery} onValidationChange={setHasErrors} />
      </div>
    </div>
  )
}

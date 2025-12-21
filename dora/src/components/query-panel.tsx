"use client"

import { useState } from "react"
import { Play, Loader2, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QueryPanelProps {
  onClose: () => void
}

export function QueryPanel({ onClose }: QueryPanelProps) {
  const [query, setQuery] = useState("SELECT * FROM users\nWHERE is_active = true\nLIMIT 100;")
  const [isRunning, setIsRunning] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleRun = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 800)
  }

  return (
    <div
      className={`flex flex-col border-b border-border/60 bg-card/90 backdrop-blur-sm transition-all ${isExpanded ? "h-40" : "h-8"}`}
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/40 px-2 bg-secondary/20">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className="font-medium">Query</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div className="flex-1 overflow-hidden p-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-full w-full resize-none bg-transparent font-mono text-xs text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none"
            placeholder="SELECT * FROM ..."
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}

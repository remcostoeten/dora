'use client'

import { FileJson } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Script } from '@/types/database'

type ScriptsCompleteProps = {
  scripts: Script[]
  activeScriptId: number | null
  unsavedChanges: Set<number>
  onSelectScript?: (script: Script) => void
  onCreateNewScript?: () => void
  onDeleteScript?: (script: Script) => void
}

export function ScriptsComplete({
  scripts,
  activeScriptId,
  unsavedChanges,
  onSelectScript,
  onCreateNewScript,
  onDeleteScript,
}: ScriptsCompleteProps) {
  return (
    <div className="scrollable-container h-full space-y-1 overflow-y-auto">
      {scripts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <FileJson className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">No saved scripts yet</p>
          <p className="text-xs text-muted-foreground/70">Save your SQL queries to access them later</p>
        </div>
      ) : (
        scripts.map((script) => (
          <div key={script.id} className="group">
            <Button
              variant="ghost"
              className={`h-auto w-full justify-start rounded-sm p-1 transition-all duration-200 ${activeScriptId === script.id
                  ? 'bg-primary/20'
                  : 'hover:bg-background hover:bg-primary/20'
                }`}
              onClick={() => onSelectScript?.(script)}
            >
              <div className="flex w-full items-center gap-3">
                <div className="shrink-0 pl-1">
                  <FileJson className="h-3 w-3 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-foreground">
                    {script.name}
                    {activeScriptId === script.id && unsavedChanges.has(script.id) && (
                      <span className="text-orange-500">*</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground/80">
                    Modified {new Date(script.updated_at * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

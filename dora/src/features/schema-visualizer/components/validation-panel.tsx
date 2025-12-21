"use client"

import { AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Lightbulb } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ValidationResult, ValidationError } from "../utils/schema-validation"

type ValidationPanelProps = {
  validation: ValidationResult
  onFocusTable?: (tableName: string) => void
}

export function ValidationPanel({ validation, onFocusTable }: ValidationPanelProps) {
  const [errorsOpen, setErrorsOpen] = useState(true)
  const [warningsOpen, setWarningsOpen] = useState(true)

  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <h3 className="font-medium text-sm">Validation</h3>
        </div>
        <div className="flex items-center gap-2">
          {validation.errors.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {validation.errors.length} errors
            </Badge>
          )}
          {validation.warnings.length > 0 && (
            <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
              {validation.warnings.length} warnings
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {!hasIssues && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="font-medium text-sm">Schema looks good!</p>
              <p className="text-xs text-muted-foreground mt-1">No validation errors or warnings found.</p>
            </div>
          )}

          {/* Errors section */}
          {validation.errors.length > 0 && (
            <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 px-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Errors</span>
                  </div>
                  {errorsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2">
                  {validation.errors.map((error, idx) => (
                    <ValidationItem key={`error-${idx}`} item={error} onFocusTable={onFocusTable} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Warnings section */}
          {validation.warnings.length > 0 && (
            <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 px-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">Warnings</span>
                  </div>
                  {warningsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2 mt-2">
                  {validation.warnings.map((warning, idx) => (
                    <ValidationItem key={`warning-${idx}`} item={warning} onFocusTable={onFocusTable} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ValidationItem({
  item,
  onFocusTable,
}: {
  item: ValidationError
  onFocusTable?: (tableName: string) => void
}) {
  const isError = item.type === "error"

  return (
    <div
      className={`rounded-md border p-3 ${
        isError ? "border-destructive/30 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.message}</p>
          {item.tableName && (
            <button
              onClick={() => onFocusTable?.(item.tableName!)}
              className="text-xs text-primary hover:underline mt-1"
            >
              Go to {item.tableName}
              {item.columnName && `.${item.columnName}`}
            </button>
          )}
          {item.suggestion && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-muted/50">
              <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{item.suggestion}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

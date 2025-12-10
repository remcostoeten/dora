'use client'

import { TableProperties, Search, ChevronRight } from 'lucide-react'
import type { Schema } from '@/types/database'

type DatabaseSchemaItemsProps = {
  databaseSchema: Schema | null
  loadingSchema: boolean
  selectedConnection: string | null
  onTableClick?: (tableName: string, schema: string) => void
}

export function DatabaseSchemaItems({
  databaseSchema,
  loadingSchema,
  selectedConnection,
  onTableClick,
}: DatabaseSchemaItemsProps) {
  const sortedTables = databaseSchema?.tables?.toSorted((a, b) => a.name.localeCompare(b.name)) || []

  if (!selectedConnection) {
    return (
      <div className="h-full space-y-3 overflow-y-auto">
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <TableProperties className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">No connection selected</p>
          <p className="text-xs text-muted-foreground/70">Select a connection to view tables</p>
        </div>
      </div>
    )
  }

  if (loadingSchema) {
    return (
      <div className="h-full space-y-3 overflow-y-auto">
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <TableProperties className="h-6 w-6 animate-pulse text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Loading schema...</p>
        </div>
      </div>
    )
  }

  if (!databaseSchema) {
    return (
      <div className="h-full space-y-3 overflow-y-auto">
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <TableProperties className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Schema not loaded</p>
          <p className="text-xs text-muted-foreground/70">Connect to database to view tables</p>
        </div>
      </div>
    )
  }

  if (databaseSchema.tables?.length === 0) {
    return (
      <div className="h-full space-y-3 overflow-y-auto">
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <TableProperties className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">No tables found</p>
          <p className="text-xs text-muted-foreground/70">This database has no tables</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto">
      {sortedTables.map((table) => (
        <details key={table.name} className="group">
          <summary className="relative flex list-none items-center gap-3 rounded-none p-1 transition-all duration-200 hover:bg-black/3 dark:hover:bg-white/3">
            <ChevronRight className="h-4 w-4 text-muted-foreground/80 group-open:rotate-90" />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium text-foreground">{table.name}</div>
              <div className="truncate text-xs text-muted-foreground/60">
                {table.schema && table.schema !== 'public' ? `${table.schema} • ` : ''}
                {table.columns.length} columns
              </div>
            </div>
            {onTableClick && (
              <button
                className="flex-shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground/70 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onTableClick(table.name, table.schema)
                }}
                title="Browse table data"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="absolute right-0 bottom-0 left-0 h-px bg-border/40" />
          </summary>
          <div className="relative ml-5 space-y-0.5">
            {table.columns.map((column) => (
              <div
                key={column.name}
                className="flex items-center gap-2 rounded-none px-2 py-1.5 text-xs transition-colors duration-200 hover:bg-black/2 dark:hover:bg-white/2"
              >
                <div className="flex-shrink-0">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{column.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground/60">
                    {column.data_type}
                    {column.is_nullable ? '' : ' • not null'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

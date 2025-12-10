'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Table as TableIcon, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { Schema } from '@/types/database'

type SchemaBrowserProps = {
  schema: Schema | null
  onRefresh?: () => void
  loading?: boolean
}

export function SchemaBrowser({ schema, onRefresh, loading }: SchemaBrowserProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

  function toggleTable(tableName: string) {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) {
        next.delete(tableName)
      } else {
        next.add(tableName)
      }
      return next
    })
  }

  if (!schema) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        Connect to a database to view schema
      </div>
    )
  }

  const tablesBySchema = schema.tables.reduce(
    (acc, table) => {
      if (!acc[table.schema]) {
        acc[table.schema] = []
      }
      acc[table.schema].push(table)
      return acc
    },
    {} as Record<string, typeof schema.tables>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Schema</h3>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <Accordion type="multiple" className="w-full">
          {Object.entries(tablesBySchema).map(([schemaName, tables]) => (
            <AccordionItem key={schemaName} value={schemaName}>
              <AccordionTrigger className="text-sm font-medium">
                {schemaName}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pl-2">
                  {tables.map((table) => {
                    const isExpanded = expandedTables.has(
                      `${table.schema}.${table.name}`
                    )
                    return (
                      <div key={`${table.schema}.${table.name}`}>
                        <button
                          onClick={() =>
                            toggleTable(`${table.schema}.${table.name}`)
                          }
                          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <TableIcon className="h-3 w-3 text-primary" />
                          <span>{table.name}</span>
                        </button>
                        {isExpanded && (
                          <div className="ml-8 mt-1 space-y-0.5">
                            {table.columns.map((column) => (
                              <div
                                key={column.name}
                                className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 rounded-sm"
                              >
                                <span>{column.name}</span>
                                <span className="text-[10px]">
                                  {column.data_type}
                                  {!column.is_nullable && ' NOT NULL'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}

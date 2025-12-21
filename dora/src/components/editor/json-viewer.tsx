'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type JsonViewerProps = {
  data: JsonValue
  name?: string
  depth?: number
}

export function JsonViewer({ data, name, depth = 0 }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  async function copyToClipboard(value: JsonValue) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  function renderValue(value: JsonValue, key?: string): React.ReactNode {
    if (value === null) {
      return <span className="text-muted-foreground italic">null</span>
    }

    if (typeof value === 'boolean') {
      return <span className="text-warning">{value ? 'true' : 'false'}</span>
    }

    if (typeof value === 'number') {
      return <span className="text-primary">{value}</span>
    }

    if (typeof value === 'string') {
      return <span className="text-success">"{value}"</span>
    }

    if (Array.isArray(value)) {
      return (
        <JsonArray data={value} name={key} depth={depth + 1} />
      )
    }

    if (typeof value === 'object') {
      return (
        <JsonObject data={value} name={key} depth={depth + 1} />
      )
    }

    return <span>{String(value)}</span>
  }

  if (data === null || typeof data !== 'object') {
    return (
      <div className="flex items-center gap-2 py-1">
        {name && <span className="font-medium">{name}:</span>}
        {renderValue(data)}
      </div>
    )
  }

  const isArray = Array.isArray(data)
  const entries = isArray ? data : Object.entries(data)
  const count = isArray ? data.length : Object.keys(data).length

  return (
    <div className="font-mono text-sm">
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="hover:bg-accent rounded p-0.5"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {name && <span className="font-medium">{name}:</span>}
        <span className="text-muted-foreground">
          {isArray ? '[' : '{'} {count} {isArray ? 'items' : 'properties'}{' '}
          {isArray ? ']' : '}'}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => copyToClipboard(data)}
          className="h-6 w-6"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {expanded && (
        <div className="ml-6 border-l border-border pl-4">
          {isArray
            ? (data as JsonValue[]).map((item, index) => (
              <div key={index}>{renderValue(item, `[${index}]`)}</div>
            ))
            : Object.entries(data as { [key: string]: JsonValue }).map(
              ([key, value]) => (
                <div key={key}>{renderValue(value, key)}</div>
              )
            )}
        </div>
      )}
    </div>
  )
}

function JsonArray({ data, name, depth }: { data: JsonValue[]; name?: string; depth: number }) {
  return <JsonViewer data={data} name={name} depth={depth} />
}

function JsonObject({ data, name, depth }: { data: { [key: string]: JsonValue }; name?: string; depth: number }) {
  return <JsonViewer data={data} name={name} depth={depth} />
}

'use client'

import { useState } from 'react'
import { Database, History, FileText } from 'lucide-react'
import { SchemaBrowser } from './schema-browser'
import { QueryHistory } from './query-history'
import { Scripts } from './scripts'
import type { Schema, Script } from '@/types/database'
import type { UUID } from '@/types/base'

type Tab = 'schema' | 'history' | 'scripts'

type AppSidebarProps = {
  connectionId: UUID | null
  schema: Schema | null
  onRefreshSchema?: () => void
  refreshingSchema?: boolean
  onExecuteQuery?: (query: string) => void
  onEditScript?: (script: Script) => void
}

export function AppSidebar({
  connectionId,
  schema,
  onRefreshSchema,
  refreshingSchema,
  onExecuteQuery,
  onEditScript,
}: AppSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('schema')

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col h-full">
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'schema'
              ? 'bg-accent text-accent-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <Database className="h-4 w-4" />
          Schema
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-accent text-accent-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <History className="h-4 w-4" />
          History
        </button>
        <button
          onClick={() => setActiveTab('scripts')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'scripts'
              ? 'bg-accent text-accent-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Scripts
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'schema' && (
          <SchemaBrowser
            schema={schema}
            onRefresh={onRefreshSchema}
            loading={refreshingSchema}
          />
        )}
        {activeTab === 'history' && connectionId && (
          <QueryHistory connectionId={connectionId} onExecute={onExecuteQuery} />
        )}
        {activeTab === 'scripts' && (
          <Scripts
            connectionId={connectionId || undefined}
            onExecute={onExecuteQuery}
            onEdit={onEditScript}
          />
        )}
      </div>
    </div>
  )
}

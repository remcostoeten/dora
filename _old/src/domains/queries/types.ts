import type { Json, UUID, ID } from '@/shared/types/base'

export type Page = Json[][]

export type QueryStatus = 'Pending' | 'Running' | 'Completed' | 'Error'

export type QueryHistoryEntry = {
  id: number
  connection_id: string
  query_text: string
  executed_at: number
  duration_ms: number | null
  status: string
  row_count: number
  error_message: string | null
}

export type SqlEditorProps = {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  loading?: boolean
  placeholder?: string
}

export type ScriptTabsProps = {
  scripts: any[]
  activeScriptId: number | null
  unsavedChanges: Set<number>
  onSelectScript: (script: any) => void
  onCreateNewScript: () => void
  onDeleteScript: (script: any) => void
}

export type QueryHistoryProps = {
  queryHistory: QueryHistoryEntry[]
  onLoadFromHistory: (query: string) => void
}

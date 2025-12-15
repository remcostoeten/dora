import type { UUID } from '@/shared/types/base'

export type Script = {
  id: number
  name: string
  description: string | null
  query_text: string
  connection_id: string | null
  tags: string | null
  created_at: number
  updated_at: number
  favorite?: boolean
}

export type ScriptsPanelProps = {
  scripts: Script[]
  activeScriptId: number | null
  unsavedChanges: Set<number>
  onSelectScript: (script: Script) => void
  onCreateNewScript: () => void
  onDeleteScript: (script: Script) => void
}

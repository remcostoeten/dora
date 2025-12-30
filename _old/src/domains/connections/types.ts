import type { UUID, ID, Entity } from '@/shared/types/base'

export type DatabaseType = 'postgres' | 'sqlite' | 'cockroach'

export type DatabaseInfo =
  | { Postgres: { connection_string: string } }
  | { SQLite: { db_path: string } }

export type ConnectionInfo = {
  id: string
  name: string
  connected: boolean
  database_type: DatabaseInfo
  last_connected_at?: number
  favorite?: boolean
  color?: string
  sort_order?: number
}

export type ConnectionHistoryEntry = {
  id: number
  connection_id: string
  connection_name: string
  database_type: string
  attempted_at: number
  success: boolean
  error_message: string | null
  duration_ms: number | null
}

export type ConnectionFormProps = {
  connection?: ConnectionInfo
  onSubmit: (connection: Omit<ConnectionInfo, 'id'>) => void
  onCancel: () => void
  loading?: boolean
}

export type ConnectionListProps = {
  connections: ConnectionInfo[]
  selectedConnection: string | null
  establishingConnections: Set<string>
  onSelectConnection: (id: string) => void
  onConnectToDatabase: (id: string) => void
  onEditConnection: (connection: ConnectionInfo) => void
  onDeleteConnection: (id: string) => void
  onUpdateConnectionColor: (id: string, color: number | null) => void
  onDisconnectConnection: (id: string) => void
  onShowConnectionForm: () => void
}

export type ConnectionHistoryProps = {
  connections: ConnectionInfo[]
}

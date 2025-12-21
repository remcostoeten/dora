export type BaseEntity = {
  id: string
  createdAt?: string
  updatedAt?: string
}

export type DbStatus = "connected" | "disconnected" | "connecting"

export type DbType = "postgresql" | "libsql" | "sqlite"

export type TabType = "table" | "query"

export type ViewType = "table" | "view"

export type RowHeight = "compact" | "normal" | "comfortable"

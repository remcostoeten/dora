import type { ColumnInfo } from "@/shared/types/database"

export type SchemaNode = {
  id: string
  name: string
  schema?: string
  columns: ColumnInfo[]
  position: Position
}

export type SchemaRelation = {
  id: string
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
  type: RelationType
}

export type RelationType = "one-to-one" | "one-to-many" | "many-to-many"

export type Position = {
  x: number
  y: number
}

export type CanvasState = {
  zoom: number
  panX: number
  panY: number
}

export type VisualizerConfig = {
  showTypes: boolean
  showNullable: boolean
  showIndexes: boolean
  highlightPrimaryKeys: boolean
  highlightForeignKeys: boolean
}

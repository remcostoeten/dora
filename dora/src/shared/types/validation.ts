export type CellType = "text" | "number" | "boolean" | "enum" | "date" | "timestamp" | "json" | "uuid"

export type ValidateError = {
  type: "enum" | "min" | "max" | "pattern" | "required" | "type" | "length"
  message: string
}

export type ValidateResult = {
  valid: boolean
  errors?: ValidateError[]
  normalized?: unknown
}

export type ColConstraints = {
  enum?: string[]
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  required?: boolean
  unique?: boolean
}

export type ColMeta = {
  name: string
  type: string
  cellType: CellType
  isPrimary: boolean
  isNullable: boolean
  defaultValue?: unknown
  constraints?: ColConstraints
}

export type SchemaData = {
  tableName: string
  columns: ColMeta[]
  indexes: IndexData[]
  foreignKeys: ForeignKey[]
}

export type IndexData = {
  name: string
  columns: string[]
  unique: boolean
}

export type ForeignKey = {
  column: string
  refTable: string
  refColumn: string
}

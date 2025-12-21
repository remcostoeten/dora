import type { SchemaNode, SchemaRelation, RelationType } from "../types"

export type ValidationError = {
  type: "error" | "warning"
  code: string
  message: string
  tableName?: string
  columnName?: string
  suggestion?: string
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

// Validate a single table
export function validateTable(node: SchemaNode): ValidationError[] {
  const errors: ValidationError[] = []

  // Check for primary key
  const hasPrimaryKey = node.columns.some((col) => col.isPrimary)
  if (!hasPrimaryKey) {
    errors.push({
      type: "error",
      code: "NO_PRIMARY_KEY",
      message: `Table "${node.name}" has no primary key`,
      tableName: node.name,
      suggestion: "Add an 'id' column with isPrimary: true",
    })
  }

  // Check for duplicate column names
  const columnNames = new Set<string>()
  for (const col of node.columns) {
    if (columnNames.has(col.name)) {
      errors.push({
        type: "error",
        code: "DUPLICATE_COLUMN",
        message: `Duplicate column "${col.name}" in table "${node.name}"`,
        tableName: node.name,
        columnName: col.name,
        suggestion: "Rename one of the duplicate columns",
      })
    }
    columnNames.add(col.name)
  }

  // Check column naming conventions
  for (const col of node.columns) {
    if (!/^[a-z][a-z0-9_]*$/.test(col.name)) {
      errors.push({
        type: "warning",
        code: "NAMING_CONVENTION",
        message: `Column "${col.name}" doesn't follow snake_case convention`,
        tableName: node.name,
        columnName: col.name,
        suggestion: "Use snake_case for column names (e.g., user_id instead of userId)",
      })
    }
  }

  // Check for timestamp columns
  const hasCreatedAt = node.columns.some((col) => col.name === "created_at")
  if (!hasCreatedAt) {
    errors.push({
      type: "warning",
      code: "NO_CREATED_AT",
      message: `Table "${node.name}" has no created_at column`,
      tableName: node.name,
      suggestion: "Add a created_at timestamp column for auditing",
    })
  }

  return errors
}

// Validate a relationship
export function validateRelation(relation: SchemaRelation, nodes: SchemaNode[]): ValidationError[] {
  const errors: ValidationError[] = []

  const sourceTable = nodes.find((n) => n.name === relation.sourceTable)
  const targetTable = nodes.find((n) => n.name === relation.targetTable)

  if (!sourceTable) {
    errors.push({
      type: "error",
      code: "MISSING_SOURCE_TABLE",
      message: `Source table "${relation.sourceTable}" not found`,
      suggestion: "Create the source table first",
    })
  }

  if (!targetTable) {
    errors.push({
      type: "error",
      code: "MISSING_TARGET_TABLE",
      message: `Target table "${relation.targetTable}" not found`,
      suggestion: "Create the target table first",
    })
  }

  if (sourceTable && targetTable) {
    const sourceColumn = sourceTable.columns.find((c) => c.name === relation.sourceColumn)
    const targetColumn = targetTable.columns.find((c) => c.name === relation.targetColumn)

    if (!sourceColumn) {
      errors.push({
        type: "error",
        code: "MISSING_SOURCE_COLUMN",
        message: `Column "${relation.sourceColumn}" not found in "${relation.sourceTable}"`,
        tableName: relation.sourceTable,
        suggestion: `Add column "${relation.sourceColumn}" to table "${relation.sourceTable}"`,
      })
    }

    if (!targetColumn) {
      errors.push({
        type: "error",
        code: "MISSING_TARGET_COLUMN",
        message: `Column "${relation.targetColumn}" not found in "${relation.targetTable}"`,
        tableName: relation.targetTable,
        suggestion: `Add column "${relation.targetColumn}" to table "${relation.targetTable}"`,
      })
    }

    // Check if target column is primary key (for one-to-many)
    if (targetColumn && !targetColumn.isPrimary && relation.type === "one-to-many") {
      errors.push({
        type: "warning",
        code: "FK_NOT_TO_PK",
        message: `Foreign key references non-primary column "${relation.targetColumn}"`,
        tableName: relation.sourceTable,
        suggestion: "Foreign keys should typically reference primary key columns",
      })
    }

    // Check type compatibility
    if (sourceColumn && targetColumn && sourceColumn.type !== targetColumn.type) {
      errors.push({
        type: "warning",
        code: "TYPE_MISMATCH",
        message: `Type mismatch: ${sourceColumn.type} -> ${targetColumn.type}`,
        suggestion: "Ensure foreign key columns have matching types",
      })
    }
  }

  return errors
}

// Validate many-to-many relationships
export function validateManyToMany(nodes: SchemaNode[], relations: SchemaRelation[]): ValidationError[] {
  const errors: ValidationError[] = []

  // Find potential junction tables (tables with multiple foreign keys and no other meaningful columns)
  const junctionTables = nodes.filter((node) => {
    const fkColumns = node.columns.filter((c) => c.isForeignKey)
    const nonFkColumns = node.columns.filter((c) => !c.isForeignKey && !c.isPrimary)
    return fkColumns.length >= 2 && nonFkColumns.length <= 2
  })

  for (const junction of junctionTables) {
    const fkRelations = relations.filter((r) => r.sourceTable === junction.name && r.type === "one-to-many")

    if (fkRelations.length < 2) {
      errors.push({
        type: "warning",
        code: "INCOMPLETE_JUNCTION",
        message: `Junction table "${junction.name}" should have at least 2 foreign key relations`,
        tableName: junction.name,
        suggestion: "Add foreign key constraints for both sides of the many-to-many relationship",
      })
    }

    // Check if junction table has composite primary key
    const pkColumns = junction.columns.filter((c) => c.isPrimary)
    if (pkColumns.length < 2) {
      errors.push({
        type: "warning",
        code: "JUNCTION_NO_COMPOSITE_PK",
        message: `Junction table "${junction.name}" should use a composite primary key`,
        tableName: junction.name,
        suggestion: "Use both foreign key columns as a composite primary key",
      })
    }
  }

  return errors
}

// Full schema validation
export function validateSchema(nodes: SchemaNode[], relations: SchemaRelation[]): ValidationResult {
  const allErrors: ValidationError[] = []

  // Validate each table
  for (const node of nodes) {
    allErrors.push(...validateTable(node))
  }

  // Validate each relation
  for (const relation of relations) {
    allErrors.push(...validateRelation(relation, nodes))
  }

  // Validate many-to-many patterns
  allErrors.push(...validateManyToMany(nodes, relations))

  // Check for orphan tables (no relations)
  const tablesWithRelations = new Set([...relations.map((r) => r.sourceTable), ...relations.map((r) => r.targetTable)])

  for (const node of nodes) {
    if (!tablesWithRelations.has(node.name) && nodes.length > 1) {
      allErrors.push({
        type: "warning",
        code: "ORPHAN_TABLE",
        message: `Table "${node.name}" has no relationships`,
        tableName: node.name,
        suggestion: "Consider adding foreign key relationships to other tables",
      })
    }
  }

  // Check for circular dependencies
  const circularDeps = findCircularDependencies(nodes, relations)
  for (const cycle of circularDeps) {
    allErrors.push({
      type: "warning",
      code: "CIRCULAR_DEPENDENCY",
      message: `Circular dependency detected: ${cycle.join(" -> ")}`,
      suggestion: "Consider breaking the circular dependency with an intermediate table",
    })
  }

  const errors = allErrors.filter((e) => e.type === "error")
  const warnings = allErrors.filter((e) => e.type === "warning")

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// Find circular dependencies using DFS
function findCircularDependencies(nodes: SchemaNode[], relations: SchemaRelation[]): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const parent = new Map<string, string>()

  // Build adjacency list
  const graph = new Map<string, string[]>()
  for (const node of nodes) {
    graph.set(node.name, [])
  }
  for (const rel of relations) {
    const targets = graph.get(rel.sourceTable) || []
    targets.push(rel.targetTable)
    graph.set(rel.sourceTable, targets)
  }

  function dfs(node: string, path: string[]): void {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, node)
        dfs(neighbor, [...path])
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor])
        }
      }
    }

    recursionStack.delete(node)
  }

  for (const node of nodes) {
    if (!visited.has(node.name)) {
      dfs(node.name, [])
    }
  }

  return cycles
}

// Suggest relationship type based on column analysis
export function suggestRelationType(
  sourceTable: SchemaNode,
  targetTable: SchemaNode,
  sourceColumn: string,
  targetColumn: string,
): RelationType {
  const sourcePk = sourceTable.columns.find((c) => c.isPrimary)
  const targetPk = targetTable.columns.find((c) => c.isPrimary)

  // If source column is primary key and target column is primary key, likely one-to-one
  if (sourcePk?.name === sourceColumn && targetPk?.name === targetColumn) {
    return "one-to-one"
  }

  // If source column references target's primary key, likely one-to-many
  if (targetPk?.name === targetColumn) {
    return "one-to-many"
  }

  // Default to one-to-many
  return "one-to-many"
}

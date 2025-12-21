import type { SchemaNode, SchemaRelation } from "../types"

export type ExportFormat = "postgresql" | "sqlite" | "mysql" | "drizzle" | "prisma" | "raw-sql"

export type ExportOptions = {
  format: ExportFormat
  includeDropStatements?: boolean
  includeIndexes?: boolean
  schemaName?: string
}

// PostgreSQL export
function exportToPostgreSQL(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  const lines: string[] = []

  if (options.schemaName) {
    lines.push(`CREATE SCHEMA IF NOT EXISTS ${options.schemaName};`)
    lines.push(`SET search_path TO ${options.schemaName};`)
    lines.push("")
  }

  // Drop statements
  if (options.includeDropStatements) {
    lines.push("-- Drop existing tables")
    for (const node of [...nodes].reverse()) {
      lines.push(`DROP TABLE IF EXISTS ${node.name} CASCADE;`)
    }
    lines.push("")
  }

  // Create tables
  for (const node of nodes) {
    lines.push(`-- Table: ${node.name}`)
    lines.push(`CREATE TABLE ${node.name} (`)

    const columnDefs: string[] = []
    const constraints: string[] = []
    const primaryKeys: string[] = []

    for (const col of node.columns) {
      let colDef = `  ${col.name} ${mapTypeToPostgreSQL(col.type)}`

      if (!col.isNullable) {
        colDef += " NOT NULL"
      }

      if (col.defaultValue) {
        colDef += ` DEFAULT ${col.defaultValue}`
      }

      if (col.isPrimary) {
        primaryKeys.push(col.name)
      }

      columnDefs.push(colDef)
    }

    // Primary key constraint
    if (primaryKeys.length > 0) {
      if (primaryKeys.length === 1) {
        constraints.push(`  PRIMARY KEY (${primaryKeys[0]})`)
      } else {
        constraints.push(`  PRIMARY KEY (${primaryKeys.join(", ")})`)
      }
    }

    // Foreign key constraints
    for (const col of node.columns) {
      if (col.isForeignKey && col.references) {
        constraints.push(`  FOREIGN KEY (${col.name}) REFERENCES ${col.references.table}(${col.references.column})`)
      }
    }

    lines.push([...columnDefs, ...constraints].join(",\n"))
    lines.push(");")
    lines.push("")
  }

  // Indexes
  if (options.includeIndexes) {
    lines.push("-- Indexes")
    for (const node of nodes) {
      for (const col of node.columns) {
        if (col.isForeignKey) {
          lines.push(`CREATE INDEX idx_${node.name}_${col.name} ON ${node.name}(${col.name});`)
        }
      }
    }
    lines.push("")
  }

  return lines.join("\n")
}

// SQLite export
function exportToSQLite(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  const lines: string[] = []

  lines.push("-- Enable foreign keys")
  lines.push("PRAGMA foreign_keys = ON;")
  lines.push("")

  if (options.includeDropStatements) {
    lines.push("-- Drop existing tables")
    for (const node of [...nodes].reverse()) {
      lines.push(`DROP TABLE IF EXISTS ${node.name};`)
    }
    lines.push("")
  }

  for (const node of nodes) {
    lines.push(`-- Table: ${node.name}`)
    lines.push(`CREATE TABLE ${node.name} (`)

    const columnDefs: string[] = []
    const primaryKeys: string[] = []

    for (const col of node.columns) {
      let colDef = `  ${col.name} ${mapTypeToSQLite(col.type)}`

      if (col.isPrimary && node.columns.filter((c) => c.isPrimary).length === 1) {
        colDef += " PRIMARY KEY"
      }

      if (!col.isNullable) {
        colDef += " NOT NULL"
      }

      if (col.defaultValue) {
        colDef += ` DEFAULT ${col.defaultValue}`
      }

      if (col.isForeignKey && col.references) {
        colDef += ` REFERENCES ${col.references.table}(${col.references.column})`
      }

      if (col.isPrimary) {
        primaryKeys.push(col.name)
      }

      columnDefs.push(colDef)
    }

    // Composite primary key
    if (primaryKeys.length > 1) {
      columnDefs.push(`  PRIMARY KEY (${primaryKeys.join(", ")})`)
    }

    lines.push(columnDefs.join(",\n"))
    lines.push(");")
    lines.push("")
  }

  return lines.join("\n")
}

// MySQL export
function exportToMySQL(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  const lines: string[] = []

  if (options.schemaName) {
    lines.push(`CREATE DATABASE IF NOT EXISTS ${options.schemaName};`)
    lines.push(`USE ${options.schemaName};`)
    lines.push("")
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 0;")
  lines.push("")

  if (options.includeDropStatements) {
    for (const node of nodes) {
      lines.push(`DROP TABLE IF EXISTS ${node.name};`)
    }
    lines.push("")
  }

  for (const node of nodes) {
    lines.push(`-- Table: ${node.name}`)
    lines.push(`CREATE TABLE ${node.name} (`)

    const columnDefs: string[] = []
    const constraints: string[] = []
    const primaryKeys: string[] = []

    for (const col of node.columns) {
      let colDef = `  ${col.name} ${mapTypeToMySQL(col.type)}`

      if (!col.isNullable) {
        colDef += " NOT NULL"
      }

      if (col.defaultValue) {
        colDef += ` DEFAULT ${col.defaultValue}`
      }

      if (col.isPrimary) {
        primaryKeys.push(col.name)
      }

      columnDefs.push(colDef)
    }

    if (primaryKeys.length > 0) {
      constraints.push(`  PRIMARY KEY (${primaryKeys.join(", ")})`)
    }

    for (const col of node.columns) {
      if (col.isForeignKey && col.references) {
        constraints.push(`  FOREIGN KEY (${col.name}) REFERENCES ${col.references.table}(${col.references.column})`)
      }
    }

    lines.push([...columnDefs, ...constraints].join(",\n"))
    lines.push(") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")
    lines.push("")
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;")

  return lines.join("\n")
}

// Drizzle ORM export
function exportToDrizzle(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  const lines: string[] = []

  lines.push(
    'import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, bigint, jsonb, primaryKey } from "drizzle-orm/pg-core";',
  )
  lines.push('import { relations } from "drizzle-orm";')
  lines.push("")

  // Tables
  for (const node of nodes) {
    const pkCols = node.columns.filter((c) => c.isPrimary)
    const hasCompositePk = pkCols.length > 1

    lines.push(`export const ${toCamelCase(node.name)} = pgTable("${node.name}", {`)

    for (const col of node.columns) {
      const drizzleType = mapTypeToDrizzle(col.type)
      let colDef = `  ${toCamelCase(col.name)}: ${drizzleType}("${col.name}")`

      if (col.isPrimary && !hasCompositePk) {
        colDef += ".primaryKey()"
      }

      if (!col.isNullable) {
        colDef += ".notNull()"
      }

      if (col.defaultValue) {
        colDef += `.default(${col.defaultValue})`
      }

      if (col.isForeignKey && col.references) {
        colDef += `.references(() => ${toCamelCase(col.references.table)}.${toCamelCase(col.references.column)})`
      }

      lines.push(colDef + ",")
    }

    // Composite primary key
    if (hasCompositePk) {
      lines.push(`}, (table) => ({`)
      lines.push(`  pk: primaryKey({ columns: [${pkCols.map((c) => `table.${toCamelCase(c.name)}`).join(", ")}] }),`)
      lines.push(`})`)
    }

    lines.push("});")
    lines.push("")
  }

  // Relations
  lines.push("// Relations")
  for (const node of nodes) {
    const nodeRelations = relations.filter((r) => r.sourceTable === node.name || r.targetTable === node.name)

    if (nodeRelations.length > 0) {
      lines.push(
        `export const ${toCamelCase(node.name)}Relations = relations(${toCamelCase(node.name)}, ({ one, many }) => ({`,
      )

      for (const rel of nodeRelations) {
        if (rel.sourceTable === node.name) {
          // This table has the foreign key
          lines.push(`  ${toCamelCase(rel.targetTable)}: one(${toCamelCase(rel.targetTable)}, {`)
          lines.push(`    fields: [${toCamelCase(node.name)}.${toCamelCase(rel.sourceColumn)}],`)
          lines.push(`    references: [${toCamelCase(rel.targetTable)}.${toCamelCase(rel.targetColumn)}],`)
          lines.push(`  }),`)
        } else {
          // This table is referenced
          lines.push(`  ${toCamelCase(rel.sourceTable)}: many(${toCamelCase(rel.sourceTable)}),`)
        }
      }

      lines.push("}));")
      lines.push("")
    }
  }

  return lines.join("\n")
}

// Prisma export
function exportToPrisma(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  const lines: string[] = []

  lines.push("generator client {")
  lines.push('  provider = "prisma-client-js"')
  lines.push("}")
  lines.push("")
  lines.push("datasource db {")
  lines.push('  provider = "postgresql"')
  lines.push('  url      = env("DATABASE_URL")')
  lines.push("}")
  lines.push("")

  for (const node of nodes) {
    lines.push(`model ${toPascalCase(node.name)} {`)

    for (const col of node.columns) {
      let colDef = `  ${toCamelCase(col.name)} ${mapTypeToPrisma(col.type)}`

      if (col.isPrimary) {
        colDef += " @id"
        if (col.type.includes("uuid")) {
          colDef += " @default(uuid())"
        } else if (col.type.includes("int")) {
          colDef += " @default(autoincrement())"
        }
      }

      if (col.isNullable) {
        colDef = colDef.replace(mapTypeToPrisma(col.type), mapTypeToPrisma(col.type) + "?")
      }

      if (col.name === "created_at") {
        colDef += " @default(now())"
      }

      lines.push(colDef)
    }

    // Relations
    const nodeRelations = relations.filter((r) => r.sourceTable === node.name)
    for (const rel of nodeRelations) {
      lines.push(
        `  ${toCamelCase(rel.targetTable)} ${toPascalCase(rel.targetTable)} @relation(fields: [${toCamelCase(rel.sourceColumn)}], references: [${toCamelCase(rel.targetColumn)}])`,
      )
    }

    // Reverse relations
    const reverseRelations = relations.filter((r) => r.targetTable === node.name)
    for (const rel of reverseRelations) {
      lines.push(`  ${toCamelCase(rel.sourceTable)}s ${toPascalCase(rel.sourceTable)}[]`)
    }

    lines.push("")
    lines.push(`  @@map("${node.name}")`)
    lines.push("}")
    lines.push("")
  }

  return lines.join("\n")
}

// Main export function
export function exportSchema(nodes: SchemaNode[], relations: SchemaRelation[], options: ExportOptions): string {
  switch (options.format) {
    case "postgresql":
      return exportToPostgreSQL(nodes, relations, options)
    case "sqlite":
      return exportToSQLite(nodes, relations, options)
    case "mysql":
      return exportToMySQL(nodes, relations, options)
    case "drizzle":
      return exportToDrizzle(nodes, relations, options)
    case "prisma":
      return exportToPrisma(nodes, relations, options)
    case "raw-sql":
      return exportToPostgreSQL(nodes, relations, { ...options, includeDropStatements: false })
    default:
      return exportToPostgreSQL(nodes, relations, options)
  }
}

// Type mapping helpers
function mapTypeToPostgreSQL(type: string): string {
  const typeMap: Record<string, string> = {
    uuid: "UUID",
    int: "INTEGER",
    bigint: "BIGINT",
    varchar: "VARCHAR(255)",
    text: "TEXT",
    boolean: "BOOLEAN",
    timestamp: "TIMESTAMP WITH TIME ZONE",
    datetime: "TIMESTAMP WITH TIME ZONE",
    decimal: "DECIMAL(10,2)",
    jsonb: "JSONB",
    json: "JSON",
  }

  // Handle parameterized types like varchar(100)
  const match = type.match(/^(\w+)$$(.+)$$$/)
  if (match) {
    const [, baseType, params] = match
    if (baseType === "varchar") return `VARCHAR(${params})`
    if (baseType === "decimal") return `DECIMAL(${params})`
  }

  return typeMap[type.toLowerCase()] || type.toUpperCase()
}

function mapTypeToSQLite(type: string): string {
  const typeMap: Record<string, string> = {
    uuid: "TEXT",
    int: "INTEGER",
    bigint: "INTEGER",
    varchar: "TEXT",
    text: "TEXT",
    boolean: "INTEGER",
    timestamp: "TEXT",
    datetime: "TEXT",
    decimal: "REAL",
    jsonb: "TEXT",
    json: "TEXT",
  }

  const baseType = type.split("(")[0].toLowerCase()
  return typeMap[baseType] || "TEXT"
}

function mapTypeToMySQL(type: string): string {
  const typeMap: Record<string, string> = {
    uuid: "CHAR(36)",
    int: "INT",
    bigint: "BIGINT",
    varchar: "VARCHAR(255)",
    text: "TEXT",
    boolean: "TINYINT(1)",
    timestamp: "TIMESTAMP",
    datetime: "DATETIME",
    decimal: "DECIMAL(10,2)",
    jsonb: "JSON",
    json: "JSON",
  }

  const match = type.match(/^(\w+)$$(.+)$$$/)
  if (match) {
    const [, baseType, params] = match
    if (baseType === "varchar") return `VARCHAR(${params})`
    if (baseType === "decimal") return `DECIMAL(${params})`
  }

  return typeMap[type.toLowerCase()] || type.toUpperCase()
}

function mapTypeToDrizzle(type: string): string {
  const typeMap: Record<string, string> = {
    uuid: "uuid",
    int: "integer",
    bigint: "bigint",
    varchar: "varchar",
    text: "text",
    boolean: "boolean",
    timestamp: "timestamp",
    datetime: "timestamp",
    decimal: "decimal",
    jsonb: "jsonb",
    json: "jsonb",
  }

  const baseType = type.split("(")[0].toLowerCase()
  return typeMap[baseType] || "text"
}

function mapTypeToPrisma(type: string): string {
  const typeMap: Record<string, string> = {
    uuid: "String",
    int: "Int",
    bigint: "BigInt",
    varchar: "String",
    text: "String",
    boolean: "Boolean",
    timestamp: "DateTime",
    datetime: "DateTime",
    decimal: "Decimal",
    jsonb: "Json",
    json: "Json",
  }

  const baseType = type.split("(")[0].toLowerCase()
  return typeMap[baseType] || "String"
}

// String helpers
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function toPascalCase(str: string): string {
  const camel = toCamelCase(str)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

// Export format metadata
export const EXPORT_FORMATS = [
  { id: "postgresql" as const, name: "PostgreSQL", extension: "sql", icon: "database" },
  { id: "sqlite" as const, name: "SQLite", extension: "sql", icon: "database" },
  { id: "mysql" as const, name: "MySQL", extension: "sql", icon: "database" },
  { id: "drizzle" as const, name: "Drizzle ORM", extension: "ts", icon: "code" },
  { id: "prisma" as const, name: "Prisma", extension: "prisma", icon: "code" },
  { id: "raw-sql" as const, name: "Raw SQL", extension: "sql", icon: "file-text" },
]

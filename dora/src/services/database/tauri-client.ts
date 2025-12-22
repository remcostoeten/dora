import { invoke } from "@tauri-apps/api/core"
import type { DbClient } from "./types"
import type { SchemaData, ColMeta, CellType } from "@/shared/types"
import type { DbSchema, QueryId, StatementInfo } from "./tauri-types"

export const tauriClient: DbClient = {
  query: async (sql, params) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const start = performance.now() // Start timing

    const [queryId] = await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    const result = await invoke<StatementInfo>("fetch_query", { queryId })

    if (result.status === "Error") {
      throw new Error(result.error || "Query failed")
    }

    const columns = await invoke<string[] | null>("get_columns", { queryId })
    const schema = await getSchema(connId)

    const colMeta: ColMeta[] =
      columns?.map((name) => {
        const col = findColumn(schema, name)
        return mapColMeta(name, col)
      }) || []

    const rows = (result.first_page || []).map((row) => {
      const obj: Record<string, unknown> = {}
      colMeta.forEach((col, i) => {
        obj[col.name] = row[i]
      })
      return obj
    })

    const end = performance.now() // End timing

    return {
      columns: colMeta,
      rows,
      total: rows.length, // Note: This might need adjustment for true server-side total count if pagination is fully offloaded
      time: end - start,
    }
  },

  updateCell: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const pkCond = buildPkWhere(req.primaryKey)
    const sql = `UPDATE ${req.table} SET ${req.column} = $1 WHERE ${pkCond}`

    await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    return { success: true }
  },

  batchUpdate: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const sql = req.changes
      .map((change) => {
        const pkCond = buildPkWhere(change.primaryKey)
        return `UPDATE ${req.table} SET ${change.column} = ${formatValue(change.newValue)} WHERE ${pkCond};`
      })
      .join("\n")

    await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    return { success: true, applied: req.changes.length, failed: 0 }
  },

  insertRow: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    if (!req.values || Object.keys(req.values).length === 0) {
      const sql = `INSERT INTO ${req.table} DEFAULT VALUES`
      await invoke<QueryId[]>("start_query", {
        connectionId: connId,
        query: sql,
      })
    } else {
      const cols = Object.keys(req.values).join(", ")
      const vals = Object.values(req.values).map(formatValue).join(", ")
      const sql = `INSERT INTO ${req.table} (${cols}) VALUES (${vals})`
      await invoke<QueryId[]>("start_query", {
        connectionId: connId,
        query: sql,
      })
    }

    return { success: true }
  },

  deleteRow: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const pkCond = buildPkWhere(req.primaryKey)
    const sql = `DELETE FROM ${req.table} WHERE ${pkCond}`

    await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    return { success: true }
  },

  duplicateRow: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const pkCond = buildPkWhere(req.primaryKey)
    const sql = `INSERT INTO ${req.table} SELECT * FROM ${req.table} WHERE ${pkCond}`

    await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    return { success: true }
  },

  fetchSchema: async (table) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const dbSchema = await invoke<DbSchema>("get_database_schema", {
      connectionId: connId,
    })

    const tableInfo = dbSchema.tables.find((t) => t.name === table)
    if (!tableInfo) throw new Error(`Table ${table} not found`)

    const columns: ColMeta[] = tableInfo.columns.map((col) => mapColMeta(col.name, col))

    const schema: SchemaData = {
      tableName: table,
      columns,
      indexes: [],
      foreignKeys: [],
    }

    return schema
  },

  validateCell: async (req) => {
    // TODO: Implement deeper server-side validation using column types
    if (req.value === undefined) {
      return { valid: false, message: "Value cannot be undefined" }
    }
    return { valid: true }
  },

  bulkDelete: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    let deleted = 0
    let failed = 0
    const errors: Array<{ index: number; message: string }> = []

    // Build DELETE statements for each row in a transaction
    const deleteStatements = req.primaryKeys.map((pk, index) => {
      const pkCond = buildPkWhere(pk)
      return `DELETE FROM ${req.table} WHERE ${pkCond};`
    })

    // Wrap in transaction for atomicity
    const sql = `
      BEGIN;
      ${deleteStatements.join("\n")}
      COMMIT;
    `

    try {
      await invoke<QueryId[]>("start_query", {
        connectionId: connId,
        query: sql,
      })
      deleted = req.primaryKeys.length
    } catch (error) {
      // If transaction fails, try individual deletes to report specific failures
      for (let i = 0; i < req.primaryKeys.length; i++) {
        try {
          const pkCond = buildPkWhere(req.primaryKeys[i])
          await invoke<QueryId[]>("start_query", {
            connectionId: connId,
            query: `DELETE FROM ${req.table} WHERE ${pkCond}`,
          })
          deleted++
        } catch (err) {
          failed++
          errors.push({
            index: i,
            message: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
    }

    return {
      success: failed === 0,
      deleted,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    }
  },

  exportTable: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    // Fetch all data
    const whereClause = req.where ? ` WHERE ${req.where}` : ""
    const selectSql = `SELECT * FROM ${req.table}${whereClause}`

    const [queryId] = await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: selectSql,
    })

    const result = await invoke<StatementInfo>("fetch_query", { queryId })

    if (result.status === "Error") {
      return { success: false, data: "", rowCount: 0, error: result.error || undefined }
    }

    const columns = await invoke<string[] | null>("get_columns", { queryId })
    const rows = result.first_page || []

    if (req.format === "json") {
      // Export as JSON array
      const jsonRows = rows.map((row) => {
        const obj: Record<string, unknown> = {}
        columns?.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
      return {
        success: true,
        data: JSON.stringify(jsonRows, null, 2),
        rowCount: rows.length,
      }
    } else {
      // Export as SQL INSERT statements
      let sql = ""

      if (req.includeSchema) {
        // Fetch schema for CREATE TABLE
        const schema = await invoke<DbSchema>("get_database_schema", { connectionId: connId })
        const tableInfo = schema.tables.find((t) => t.name === req.table)
        if (tableInfo) {
          const colDefs = tableInfo.columns
            .map((c) => `"${c.name}" ${c.data_type}${c.is_nullable ? "" : " NOT NULL"}`)
            .join(",\n  ")
          sql += `CREATE TABLE IF NOT EXISTS "${req.table}" (\n  ${colDefs}\n);\n\n`
        }
      }

      // Generate INSERT statements
      for (const row of rows) {
        const values = row.map(formatValue).join(", ")
        sql += `INSERT INTO "${req.table}" (${columns?.map((c) => `"${c}"`).join(", ")}) VALUES (${values});\n`
      }

      return {
        success: true,
        data: sql,
        rowCount: rows.length,
      }
    }
  },

  duplicateTable: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const schema = req.schema || "public"

    if (req.includeData) {
      // Create table with data
      const sql = `CREATE TABLE "${schema}"."${req.newTableName}" AS SELECT * FROM "${schema}"."${req.sourceTable}"`
      await invoke<QueryId[]>("start_query", { connectionId: connId, query: sql })
    } else {
      // Create table structure only (no data)
      const sql = `CREATE TABLE "${schema}"."${req.newTableName}" AS SELECT * FROM "${schema}"."${req.sourceTable}" WHERE false`
      await invoke<QueryId[]>("start_query", { connectionId: connId, query: sql })
    }

    return { success: true, tableName: req.newTableName }
  },

  renameTable: async (req) => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const schema = req.schema || "public"
    const sql = `ALTER TABLE "${schema}"."${req.table}" RENAME TO "${req.newName}"`

    await invoke<QueryId[]>("start_query", { connectionId: connId, query: sql })

    return { success: true }
  },

  dropTable: async (table, schema = "public") => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const sql = `DROP TABLE "${schema}"."${table}"`
    await invoke<QueryId[]>("start_query", {
      connectionId: connId,
      query: sql,
    })

    return { success: true }
  },
  getDatabaseSchema: async () => {
    const connId = getActiveConn()
    if (!connId) throw new Error("No active connection")

    const dbSchema = await invoke<DbSchema>("get_database_schema", {
      connectionId: connId,
    })

    return {
      tables: dbSchema.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        type: "table", // Backend could be improved to return type
      })),
      schemas: dbSchema.schemas,
    }
  },
}

function getActiveConn(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("activeConnectionId")
}

function buildPkWhere(pk: Record<string, unknown>): string {
  return Object.entries(pk)
    .map(([key, val]) => `${key} = ${formatValue(val)}`)
    .join(" AND ")
}

function formatValue(val: unknown): string {
  if (val === null) return "NULL"
  if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE"
  return String(val)
}

function findColumn(schema: DbSchema, colName: string) {
  for (const table of schema.tables) {
    const col = table.columns.find((c) => c.name === colName)
    if (col) return col
  }
  return null
}

function mapColMeta(name: string, col: any): ColMeta {
  const cellType = inferCellType(col?.data_type || "text")

  return {
    name,
    type: col?.data_type || "text",
    cellType,
    isPrimary: false,
    isNullable: col?.is_nullable ?? true,
    constraints: inferConstraints(cellType),
  }
}

function inferCellType(dataType: string): CellType {
  const lower = dataType.toLowerCase()
  if (lower.includes("int") || lower.includes("serial")) return "number"
  if (lower.includes("bool")) return "boolean"
  if (lower.includes("timestamp") || lower.includes("time")) return "timestamp"
  if (lower.includes("date")) return "date"
  if (lower.includes("json")) return "json"
  if (lower.includes("uuid")) return "uuid"
  return "text"
}

function inferConstraints(cellType: CellType) {
  if (cellType === "boolean") {
    return { enum: ["true", "false"] }
  }
  return undefined
}

async function getSchema(connId: string): Promise<DbSchema> {
  return invoke<DbSchema>("get_database_schema", { connectionId: connId })
}

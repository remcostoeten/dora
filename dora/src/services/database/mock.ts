import type { DbClient } from "./types"
import type { SchemaData, ColMeta } from "@/shared/types"
import { conn } from "@/services/connection"
import { getTableData, getTableNames, type TableName } from "@/lib/api/mock-data"

// Check if there's an active connection
function requiresConnection(): boolean {
  const activeId = conn.getActive()
  return activeId !== null
}

// Extract table name from SQL query
function parseTableFromSql(sql: string): string | null {
  // Match: SELECT ... FROM "tablename" or FROM tablename or SELECT COUNT(*) FROM ...
  const match = sql.match(/FROM\s+["']?(\w+)["']?/i)
  return match ? match[1] : null
}

// Parse LIMIT and OFFSET from SQL
function parseLimitOffset(sql: string): { limit: number; offset: number } {
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i)
  return {
    limit: limitMatch ? parseInt(limitMatch[1], 10) : 100,
    offset: offsetMatch ? parseInt(offsetMatch[1], 10) : 0,
  }
}

// Get column metadata for a table
function getTableColumns(tableName: string): ColMeta[] {
  const columnSchemas: Record<string, ColMeta[]> = {
    users: [
      { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
      { name: "email", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "firstName", type: "varchar", cellType: "text", isPrimary: false, isNullable: true },
      { name: "lastName", type: "varchar", cellType: "text", isPrimary: false, isNullable: true },
      { name: "status", type: "varchar", cellType: "enum", isPrimary: false, isNullable: false },
      { name: "subscriptionTier", type: "varchar", cellType: "enum", isPrimary: false, isNullable: true },
      { name: "lastLoginAt", type: "timestamptz", cellType: "timestamp", isPrimary: false, isNullable: true },
      { name: "createdAt", type: "timestamptz", cellType: "timestamp", isPrimary: false, isNullable: false },
      { name: "updatedAt", type: "timestamptz", cellType: "timestamp", isPrimary: false, isNullable: false },
    ],
    orders: [
      { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
      { name: "userId", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "orderNumber", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "status", type: "varchar", cellType: "enum", isPrimary: false, isNullable: false },
      { name: "totalAmount", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
      { name: "currency", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "shippingAddress", type: "text", cellType: "text", isPrimary: false, isNullable: true },
      { name: "orderDate", type: "timestamptz", cellType: "timestamp", isPrimary: false, isNullable: false },
    ],
    products: [
      { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
      { name: "name", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "description", type: "text", cellType: "text", isPrimary: false, isNullable: true },
      { name: "price", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
      { name: "category", type: "varchar", cellType: "text", isPrimary: false, isNullable: true },
      { name: "inStock", type: "bool", cellType: "boolean", isPrimary: false, isNullable: false },
    ],
    product_category: [
      { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
      { name: "name", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "slug", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "description", type: "text", cellType: "text", isPrimary: false, isNullable: true },
      { name: "parentId", type: "int4", cellType: "number", isPrimary: false, isNullable: true },
      { name: "isActive", type: "bool", cellType: "boolean", isPrimary: false, isNullable: false },
      { name: "displayOrder", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
    ],
    order_items: [
      { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
      { name: "orderId", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "productId", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "productName", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "quantity", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "unitPrice", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
      { name: "discount", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
      { name: "totalPrice", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
    ],
    active_users: [
      { name: "userId", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "email", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "firstName", type: "varchar", cellType: "text", isPrimary: false, isNullable: true },
      { name: "lastName", type: "varchar", cellType: "text", isPrimary: false, isNullable: true },
      { name: "lastLoginAt", type: "timestamptz", cellType: "timestamp", isPrimary: false, isNullable: false },
      { name: "sessionCount", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "totalOrders", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "lifetimeValue", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
    ],
    order_summary: [
      { name: "status", type: "varchar", cellType: "text", isPrimary: false, isNullable: false },
      { name: "orderCount", type: "int4", cellType: "number", isPrimary: false, isNullable: false },
      { name: "totalRevenue", type: "numeric", cellType: "number", isPrimary: false, isNullable: false },
    ],
  }

  return columnSchemas[tableName] || [
    { name: "id", type: "int4", cellType: "number", isPrimary: true, isNullable: false },
  ]
}

export const mockClient: DbClient = {
  query: async (sql, params) => {
    await delay(100)
    console.log("[v0] Mock query:", sql, params)

    // Guard: require active connection
    if (!requiresConnection()) {
      console.warn("[v0] No active connection - returning empty result")
      return {
        columns: [],
        rows: [],
        total: 0,
        time: 0,
      }
    }

    // Parse table name from SQL
    const tableName = parseTableFromSql(sql)
    if (!tableName) {
      console.warn("[v0] Could not parse table name from SQL")
      return { columns: [], rows: [], total: 0, time: 0 }
    }

    const isCountQuery = /SELECT\s+COUNT\(\*\)/i.test(sql)

    try {
      const allData = getTableData(tableName)
      if (isCountQuery) {
        return {
          columns: [{
            name: "total",
            type: "integer",
            cellType: "number",
            isPrimary: false,
            isNullable: false
          }],
          rows: [{ total: allData.length }],
          total: 1,
          time: 50,
        }
      }

      // Get paginated data
      const { limit, offset } = parseLimitOffset(sql)
      const paginatedData = allData.slice(offset, offset + limit)
      const columns = getTableColumns(tableName)

      return {
        columns,
        rows: paginatedData as Record<string, unknown>[],
        total: allData.length,
        time: 100,
      }
    } catch (e) {
      console.warn(`[v0] Table not found: ${tableName}`)
      return { columns: [], rows: [], total: 0, time: 0 }
    }
  },

  updateCell: async (req) => {
    await delay(50)
    console.log("[v0] Mock updateCell:", req)
    return { success: true }
  },

  batchUpdate: async (req) => {
    await delay(100)
    console.log("[v0] Mock batchUpdate:", req)
    return { success: true, applied: req.changes.length, failed: 0 }
  },

  insertRow: async (req) => {
    await delay(80)
    console.log("[v0] Mock insertRow:", req)
    return { success: true }
  },

  deleteRow: async (req) => {
    await delay(60)
    console.log("[v0] Mock deleteRow:", req)
    return { success: true }
  },

  duplicateRow: async (req) => {
    await delay(70)
    console.log("[v0] Mock duplicateRow:", req)
    return { success: true }
  },

  fetchSchema: async (table) => {
    await delay(120)
    console.log("[v0] Mock fetchSchema:", table)

    const schema: SchemaData = {
      tableName: table,
      columns: [
        {
          name: "id",
          type: "int4",
          cellType: "number",
          isPrimary: true,
          isNullable: false,
        },
        {
          name: "email",
          type: "varchar",
          cellType: "text",
          isPrimary: false,
          isNullable: false,
          constraints: {
            required: true,
            pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$",
          },
        },
        {
          name: "role",
          type: "varchar",
          cellType: "enum",
          isPrimary: false,
          isNullable: false,
          constraints: {
            enum: ["admin", "user", "viewer"],
          },
        },
        {
          name: "is_active",
          type: "bool",
          cellType: "boolean",
          isPrimary: false,
          isNullable: false,
        },
        {
          name: "created_at",
          type: "timestamptz",
          cellType: "timestamp",
          isPrimary: false,
          isNullable: false,
        },
      ],
      indexes: [],
      foreignKeys: [],
    }

    return schema
  },

  validateCell: async (req) => {
    await delay(30)
    console.log("[v0] Mock validateCell:", req)
    return { valid: true }
  },

  bulkDelete: async (req) => {
    await delay(100)
    console.log("[v0] Mock bulkDelete:", req)
    return { success: true, deleted: req.primaryKeys.length, failed: 0 }
  },

  exportTable: async (req) => {
    await delay(150)
    console.log("[v0] Mock exportTable:", req)
    return { success: true, data: "Mock Export Data", rowCount: 100 }
  },

  duplicateTable: async (req) => {
    await delay(120)
    console.log("[v0] Mock duplicateTable:", req)
    return { success: true, tableName: `${req.sourceTable}_copy` }
  },

  renameTable: async (req) => {
    await delay(80)
    console.log("[v0] Mock renameTable:", req)
    return { success: true }
  },

  dropTable: async (table, schema = "public") => {
    await delay(100)
    console.log("[v0] Mock dropTable:", table, schema)
    return { success: true }
  },

  getDatabaseSchema: async () => {
    await delay(100)

    // Guard: require active connection
    if (!requiresConnection()) {
      console.warn("[v0] No active connection - returning empty schema")
      return {
        tables: [],
        schemas: [],
      }
    }

    // Build table list from MOCK_DATA
    const tableNames = getTableNames()
    const tables = tableNames.map((name) => {
      const data = getTableData(name)
      return {
        name,
        schema: "public",
        type: "table" as const,
        rowCount: data.length,
      }
    })

    return {
      tables,
      schemas: ["public"],
    }
  },
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

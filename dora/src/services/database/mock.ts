import type { DbClient } from "./types"
import type { SchemaData, ColMeta } from "@/shared/types"

export const mockClient: DbClient = {
  query: async (sql, params) => {
    await delay(100)
    console.log("[v0] Mock query:", sql, params)

    const mockColumns: ColMeta[] = [
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
    ]

    const mockRows = [
      { id: 1, email: "admin@test.com", role: "admin", is_active: true },
      { id: 2, email: "user@test.com", role: "user", is_active: true },
      { id: 3, email: "viewer@test.com", role: "viewer", is_active: false },
    ]

    return {
      columns: mockColumns,
      rows: mockRows,
      total: mockRows.length,
      time: 100,
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
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

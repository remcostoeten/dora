import { create } from "zustand"
import type { DbConnection, TableInfo, TableSchema } from "@/shared/types"
import { useTabs } from "./tabs"
import { useCells } from "./cells"
import { useQuery } from "./query"
import { useTableView } from "./table-view"
import { useSchema } from "./schema"
import { apiClient } from "@/lib/api/client"

type ConnState = {
  connections: DbConnection[]
  activeId: string | null
  tables: TableInfo[]
  selectedTable: string | null
  tableSchemas: Record<string, TableSchema>
  isLoading: boolean
  error: string | null
  setActive: (id: string) => void
  setTables: (tables: TableInfo[]) => void
  selectTable: (name: string | null) => void
  addConnection: (conn: Omit<DbConnection, "id" | "status">) => void
  editConnection: (id: string, conn: Partial<DbConnection>) => void
  deleteConnection: (id: string) => void
  refreshTables: () => Promise<void>
  updateTableRowCount: (tableName: string, rowCount: number) => void
}

const mockConnections: DbConnection[] = [
  {
    id: "1",
    name: "Mock Database",
    type: "postgresql",
    host: "localhost",
    database: "mock_api_db",
    status: "connected",
  },
]

const staticTableSchemas: Record<string, TableSchema> = {
  users: {
    name: "users",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "email", type: "varchar(255)" },
      { name: "firstName", type: "varchar(100)", isNullable: true },
      { name: "lastName", type: "varchar(100)", isNullable: true },
      { name: "status", type: "varchar(20)" },
      { name: "subscriptionTier", type: "varchar(20)", isNullable: true },
      { name: "lastLoginAt", type: "timestamptz", isNullable: true },
      { name: "createdAt", type: "timestamptz" },
      { name: "updatedAt", type: "timestamptz" },
    ],
    indexes: [
      { name: "users_pkey", columns: ["id"], isUnique: true },
      { name: "users_email_idx", columns: ["email"], isUnique: true },
    ],
  },
  orders: {
    name: "orders",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "userId", type: "int4", isForeignKey: true, references: { table: "users", column: "id" } },
      { name: "orderNumber", type: "varchar(50)" },
      { name: "status", type: "varchar(20)" },
      { name: "totalAmount", type: "numeric(10,2)" },
      { name: "currency", type: "varchar(3)" },
      { name: "shippingAddress", type: "text", isNullable: true },
      { name: "orderDate", type: "timestamptz" },
      { name: "shippedDate", type: "timestamptz", isNullable: true },
      { name: "deliveredDate", type: "timestamptz", isNullable: true },
    ],
    indexes: [
      { name: "orders_pkey", columns: ["id"], isUnique: true },
      { name: "orders_user_id_idx", columns: ["userId"], isUnique: false },
    ],
  },
  product_category: {
    name: "product_category",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "name", type: "varchar(100)" },
      { name: "slug", type: "varchar(100)" },
      { name: "description", type: "text", isNullable: true },
      { name: "parentId", type: "int4", isNullable: true },
      { name: "isActive", type: "bool" },
      { name: "displayOrder", type: "int4" },
    ],
    indexes: [
      { name: "product_category_pkey", columns: ["id"], isUnique: true },
      { name: "product_category_slug_idx", columns: ["slug"], isUnique: true },
    ],
  },
  order_items: {
    name: "order_items",
    columns: [
      { name: "id", type: "int4", isPrimary: true },
      { name: "orderId", type: "int4", isForeignKey: true, references: { table: "orders", column: "id" } },
      { name: "productId", type: "int4" },
      { name: "productName", type: "varchar(255)" },
      { name: "quantity", type: "int4" },
      { name: "unitPrice", type: "numeric(10,2)" },
      { name: "discount", type: "numeric(5,2)" },
      { name: "totalPrice", type: "numeric(10,2)" },
      { name: "sku", type: "varchar(50)", isNullable: true },
    ],
    indexes: [
      { name: "order_items_pkey", columns: ["id"], isUnique: true },
      { name: "order_items_order_id_idx", columns: ["orderId"], isUnique: false },
    ],
  },
  active_users: {
    name: "active_users",
    columns: [
      { name: "userId", type: "int4" },
      { name: "email", type: "varchar(255)" },
      { name: "firstName", type: "varchar(100)", isNullable: true },
      { name: "lastName", type: "varchar(100)", isNullable: true },
      { name: "lastLoginAt", type: "timestamptz" },
      { name: "sessionCount", type: "int4" },
      { name: "totalOrders", type: "int4" },
      { name: "lifetimeValue", type: "numeric(10,2)" },
    ],
  },
  order_summary: {
    name: "order_summary",
    columns: [
      { name: "status", type: "varchar(20)" },
      { name: "orderCount", type: "int4" },
      { name: "totalRevenue", type: "numeric(12,2)" },
    ],
  },
  empty_table: {
    name: "empty_table",
    columns: [],
  },
}

export const useConn = create<ConnState>((set, get) => ({
  connections: mockConnections,
  activeId: "1",
  tables: [],
  selectedTable: null,
  tableSchemas: staticTableSchemas,
  isLoading: false,
  error: null,

  setActive: async (id) => {
    console.log("[v0] Switching connection to:", id)

    // Reset all dependent stores
    useTabs.getState().closeAll()
    useCells.getState().discardChanges()
    useCells.getState().setSelected(null)
    useQuery.getState().setQuery("")
    useQuery.getState().setVisible(false)
    useTableView.getState().setSort(null)
    useTableView.getState().setFilters([])
    useSchema.setState({ schemas: {} })

    set({ activeId: id, isLoading: true, error: null })

    try {
      const response = await apiClient.getTables()
      const tables: TableInfo[] = response.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.rowCount,
        type: t.type,
      }))

      set({
        tables,
        selectedTable: tables[0]?.name || null,
        isLoading: false,
      })

      console.log("[v0] Connection switched. Tables loaded:", tables.length)
    } catch (error) {
      console.error("[v0] Failed to load tables:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load tables",
        isLoading: false,
        tables: [],
        selectedTable: null,
      })
    }
  },

  setTables: (tables) => set({ tables }),

  selectTable: (name) => set({ selectedTable: name }),

  addConnection: (conn) => {
    const newConn: DbConnection = {
      ...conn,
      id: Date.now().toString(),
      status: "disconnected",
    }
    set((state) => ({
      connections: [...state.connections, newConn],
    }))
    console.log("[v0] Added connection:", newConn.name)
  },

  editConnection: (id, updates) => {
    set((state) => ({
      connections: state.connections.map((conn) => (conn.id === id ? { ...conn, ...updates } : conn)),
    }))
    console.log("[v0] Edited connection:", id)
  },

  deleteConnection: (id) => {
    const { connections, activeId } = get()
    const newConnections = connections.filter((c) => c.id !== id)

    if (newConnections.length === 0) {
      console.warn("[v0] Cannot delete last connection")
      return
    }

    set({ connections: newConnections })

    // If deleting active connection, switch to first remaining
    if (activeId === id) {
      get().setActive(newConnections[0].id)
    }

    console.log("[v0] Deleted connection:", id)
  },

  refreshTables: async () => {
    const { activeId } = get()
    if (!activeId) return

    set({ isLoading: true, error: null })

    try {
      const response = await apiClient.getTables()
      const tables: TableInfo[] = response.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.rowCount,
        type: t.type,
      }))

      set({ tables, isLoading: false })
      console.log("[v0] Refreshed tables for connection:", activeId)
    } catch (error) {
      console.error("[v0] Failed to refresh tables:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to refresh tables",
        isLoading: false,
      })
    }
  },

  updateTableRowCount: (tableName: string, rowCount: number) => {
    set((state) => ({
      tables: state.tables.map((table) => (table.name === tableName ? { ...table, rowCount } : table)),
    }))
  },
}))

if (typeof window !== "undefined") {
  useConn.getState().setActive("1")
}

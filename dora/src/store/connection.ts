import { create } from "zustand"
import type { DbConnection, TableInfo, TableSchema } from "@/shared/types"
import { useTabs } from "./tabs"
import { useCells } from "./cells"
import { useQuery } from "./query"
import { useTableView } from "./table-view"
import { useSchema } from "./schema"
import { conn } from "@/services/connection"
import { db } from "@/services/database"
import type { ConnConfig } from "@/services/connection/types"

type ConnState = {
  connections: DbConnection[]
  activeId: string | null
  tables: TableInfo[]
  selectedTable: string | null
  tableSchemas: Record<string, TableSchema>
  isLoading: boolean
  error: string | null
  loadConnections: () => Promise<void>
  setActive: (id: string) => Promise<void>
  setTables: (tables: TableInfo[]) => void
  selectTable: (name: string | null) => void
  addConnection: (config: ConnConfig) => Promise<void>
  editConnection: (id: string, updates: Partial<DbConnection>) => void
  deleteConnection: (id: string) => Promise<void>
  refreshTables: () => Promise<void>
  updateTableRowCount: (tableName: string, rowCount: number) => void
  disconnect: () => void
  dropTable: (tableName: string, schema?: string) => Promise<void>
  renameTable: (oldName: string, newName: string, schema?: string) => Promise<void>
  duplicateTable: (source: string, newName: string, includeData: boolean, schema?: string) => Promise<void>
  exportTable: (tableName: string, format: "sql" | "json") => Promise<void>
}

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
  connections: [],
  activeId: null,
  tables: [],
  selectedTable: null,
  tableSchemas: {},
  isLoading: false,
  error: null,

  loadConnections: async () => {
    set({ isLoading: true, error: null })
    try {
      const conns = await conn.list()
      const mappedConns: DbConnection[] = conns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type === "postgres" ? "postgresql" : "sqlite",
        database: c.name,
        status: c.connected ? "connected" : "disconnected",
        isDemo: c.isDemo ?? false,
      }))
      set({ connections: mappedConns, isLoading: false })

      // Auto-set active if we have one in service
      const activeId = conn.getActive()
      if (activeId && mappedConns.find((c) => c.id === activeId)) {
        get().setActive(activeId)
      }
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  setActive: async (id) => {
    const { connections } = get()
    const target = connections.find((c) => c.id === id)
    if (!target) return

    set({ activeId: id, isLoading: true, error: null })

    try {
      // If not already connected in backend, we might need a fuller config here
      // But for now let's assume the backend handles the saved connection state
      conn.setActive(id)

      const response = await db.getDatabaseSchema()
      const tables: TableInfo[] = response.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.rowCount,
        type: t.type as any,
      }))

      set({
        tables,
        selectedTable: tables[0]?.name || null,
        isLoading: false,
      })

      // Reset dependent stores
      useTabs.getState().closeAll()
      useCells.getState().discardChanges()
      useCells.getState().setSelected(null)
      useQuery.getState().setQuery("")
      useQuery.getState().setVisible(false)
      useTableView.getState().setSort(null)
      useTableView.getState().setFilters([])
      useSchema.setState({ schemas: {} })
    } catch (error) {
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

  addConnection: async (config) => {
    set({ isLoading: true, error: null })
    try {
      await conn.connect(config)
      await get().loadConnections()
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  editConnection: (id, updates) => {
    // This store doesn't currently support persistence of edits back to Tauri
    // unless we add an update_connection command
    set((state) => ({
      connections: state.connections.map((conn) => (conn.id === id ? { ...conn, ...updates } : conn)),
    }))
  },

  deleteConnection: async (id) => {
    const { activeId } = get()
    try {
      await conn.remove(id)
      await get().loadConnections()

      if (activeId === id) {
        set({ activeId: null, tables: [], selectedTable: null })
      }
    } catch (error) {
      set({ error: String(error) })
    }
  },

  refreshTables: async () => {
    const { activeId } = get()
    if (!activeId) return

    set({ isLoading: true, error: null })

    try {
      const response = await db.getDatabaseSchema()
      const tables: TableInfo[] = response.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.rowCount,
        type: t.type as any,
      }))

      set({ tables, isLoading: false })
    } catch (error) {
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

  disconnect: () => {
    const { activeId } = get()
    if (activeId) {
      conn.disconnect(activeId)
    }

    // Clear active connection state
    set({
      activeId: null,
      tables: [],
      selectedTable: null,
    })

    // Clear localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("activeConnectionId")
      } catch {
        // localStorage may be unavailable
      }
    }

    // Reset dependent stores
    useTabs.getState().closeAll()
    useCells.getState().discardChanges()
    useCells.getState().setSelected(null)
    useQuery.getState().setQuery("")
    useQuery.getState().setVisible(false)
    useTableView.getState().setSort(null)
    useTableView.getState().setFilters([])
    useTableView.getState().setData([])
    useTableView.getState().setColumns([])
    useSchema.setState({ schemas: {} })
  },

  dropTable: async (tableName: string, schema?: string) => {
    try {
      await db.dropTable(tableName, schema)
      await get().refreshTables()
    } catch (error) {
      console.error("Failed to drop table:", error)
      throw error
    }
  },

  renameTable: async (oldName: string, newName: string, schema?: string) => {
    try {
      await db.renameTable({ table: oldName, newName, schema })
      await get().refreshTables()
    } catch (error) {
      console.error("Failed to rename table:", error)
      throw error
    }
  },

  duplicateTable: async (source: string, newName: string, includeData: boolean, schema?: string) => {
    try {
      await db.duplicateTable({ sourceTable: source, newTableName: newName, includeData, schema })
      await get().refreshTables()
    } catch (error) {
      console.error("Failed to duplicate table:", error)
      throw error
    }
  },

  exportTable: async (tableName: string, format: "sql" | "json") => {
    try {
      await db.exportTable({ table: tableName, format })
    } catch (error) {
      console.error("Failed to export table:", error)
      throw error
    }
  },
}))

if (typeof window !== "undefined") {
  useConn.getState().loadConnections()
}

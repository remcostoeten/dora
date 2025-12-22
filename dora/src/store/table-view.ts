import { create } from "zustand"
import type { SortConfig, FilterConfig, PageConfig, TableColumn } from "@/shared/types"
import { db } from "@/services/database"

type TableState = {
  sort: SortConfig | null
  filters: FilterConfig[]
  page: PageConfig
  columns: TableColumn[]
  data: Record<string, unknown>[]
  totalRows: number
  lastQuery: { sql: string; time: number } | null
  isLoading: boolean
  error: string | null
  setSort: (config: SortConfig | null) => void
  setFilters: (filters: FilterConfig[]) => void
  setPage: (config: PageConfig) => void
  setData: (data: Record<string, unknown>[]) => void
  setColumns: (columns: TableColumn[]) => void
  loadTableData: (tableName: string, page?: number, pageSize?: number) => Promise<void>
  loadNextPage: (tableName: string) => Promise<void>
  loadPrevPage: (tableName: string) => Promise<void>
  loadSpecificPage: (tableName: string, pageNum: number) => Promise<void>
}

export const useTableView = create<TableState>((set, get) => ({
  sort: null,
  filters: [],
  page: { page: 0, pageSize: 100, total: 0 },
  columns: [],
  data: [],
  totalRows: 0,
  lastQuery: null,
  isLoading: false,
  error: null,

  setSort: (config) => set({ sort: config }),
  setFilters: (filters) => set({ filters }),
  setPage: (config) => set({ page: config }),

  setData: (data) => set({ data }),
  setColumns: (columns) => set({ columns }),

  loadTableData: async (tableName: string, page = 0, pageSize = 100) => {
    set({ isLoading: true, error: null })
    const { loadTableData, filters } = get()

    try {
      const offset = page * pageSize
      let queryFn = `SELECT * FROM "${tableName}"`

      const whereClauses = filters
        .map((filter) => {
          const column = `"${filter.column}"`
          const value = typeof filter.value === "string" ? `'${filter.value}'` : filter.value

          switch (filter.operator) {
            case "equals": return `${column} = ${value}`
            case "contains": return `${column} ILIKE '%${filter.value}%'`
            case "starts_with": return `${column} ILIKE '${filter.value}%'`
            case "ends_with": return `${column} ILIKE '%${filter.value}'`
            case "is_null": return `${column} IS NULL`
            case "is_not_null": return `${column} IS NOT NULL`
            default: return null
          }
        })
        .filter(Boolean)

      if (whereClauses.length > 0) {
        queryFn += ` WHERE ${whereClauses.join(" AND ")}`
      }

      const sql = `${queryFn} LIMIT ${pageSize} OFFSET ${offset}`
      const response = await db.query(sql)

      // Use the total from the response if available, or fall back to 0
      const total = response.total

      set({
        data: response.rows,
        columns: response.columns.map((col) => ({
          name: col.name,
          type: col.type,
          isPrimary: col.isPrimary,
          isNullable: col.isNullable,
        })),
        totalRows: total,
        lastQuery: {
          sql,
          time: response.time,
        },
        page: {
          page,
          pageSize,
          total,
        },
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to load table data:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load table data",
        isLoading: false,
      })
    }
  },

  loadSpecificPage: async (tableName: string, pageNum: number) => {
    const { page: currentPage } = get()
    await get().loadTableData(tableName, pageNum, currentPage.pageSize)
  },

  loadNextPage: async (tableName: string) => {
    const { page: currentPage } = get()
    await get().loadTableData(tableName, currentPage.page + 1, currentPage.pageSize)
  },

  loadPrevPage: async (tableName: string) => {
    const { page: currentPage } = get()
    if (currentPage.page <= 0) return
    await get().loadTableData(tableName, currentPage.page - 1, currentPage.pageSize)
  },
}))

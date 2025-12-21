import { create } from "zustand"
import type { SortConfig, FilterConfig, PageConfig, TableColumn } from "@/shared/types"
import { apiClient } from "@/lib/api/client"
import type { QueryId } from "@/lib/api/types"

type TableState = {
  sort: SortConfig | null
  filters: FilterConfig[]
  page: PageConfig
  columns: TableColumn[]
  data: Record<string, unknown>[]
  queryId: QueryId | null
  totalRows: number
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
  queryId: null,
  totalRows: 0,
  isLoading: false,
  error: null,

  setSort: (config) => set({ sort: config }),
  setFilters: (filters) => set({ filters }),
  setPage: (config) => set({ page: config }),

  setData: (data) => set({ data }),
  setColumns: (columns) => set({ columns }),

  loadTableData: async (tableName: string, page = 0, pageSize = 100) => {
    set({ isLoading: true, error: null })

    try {
      const response = await apiClient.getTableData(tableName, page, pageSize)

      // Convert array format to record format
      const data: Record<string, unknown>[] = response.data.map((row) => {
        const record: Record<string, unknown> = {}
        response.columns.forEach((col, idx) => {
          record[col] = row[idx]
        })
        return record
      })

      // Convert columns to TableColumn format
      const columns: TableColumn[] = response.columns.map((col) => ({
        name: col,
        type: "varchar", // Default type, could be enhanced
        isPrimary: col === "id",
        isNullable: true,
      }))

      set({
        data,
        columns,
        queryId: response.queryId,
        totalRows: response.pagination.totalRows,
        page: {
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.totalRows,
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
    set({ isLoading: true, error: null })

    try {
      await get().loadTableData(tableName, pageNum, currentPage.pageSize)
    } catch (error) {
      console.error("Failed to load page:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load page",
        isLoading: false,
      })
    }
  },

  loadNextPage: async (tableName: string) => {
    const { queryId, page: currentPage } = get()
    if (!queryId) {
      console.error("No queryId available for pagination")
      return
    }

    const nextPage = currentPage.page + 1
    set({ isLoading: true, error: null })

    try {
      const response = await apiClient.getPage(tableName, queryId, nextPage, currentPage.pageSize)

      // Convert array format to record format
      const data: Record<string, unknown>[] = response.data.map((row) => {
        const record: Record<string, unknown> = {}
        const { columns } = get()
        columns.forEach((col, idx) => {
          record[col.name] = row[idx]
        })
        return record
      })

      set({
        data,
        totalRows: response.pagination.totalRows,
        page: {
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.totalRows,
        },
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to load next page:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load next page",
        isLoading: false,
      })
    }
  },

  loadPrevPage: async (tableName: string) => {
    const { queryId, page: currentPage } = get()
    if (!queryId) {
      console.error("No queryId available for pagination")
      return
    }

    const prevPage = currentPage.page - 1
    if (prevPage < 0) return

    set({ isLoading: true, error: null })

    try {
      const response = await apiClient.getPage(tableName, queryId, prevPage, currentPage.pageSize)

      // Convert array format to record format
      const data: Record<string, unknown>[] = response.data.map((row) => {
        const record: Record<string, unknown> = {}
        const { columns } = get()
        columns.forEach((col, idx) => {
          record[col.name] = row[idx]
        })
        return record
      })

      set({
        data,
        totalRows: response.pagination.totalRows,
        page: {
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.totalRows,
        },
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to load previous page:", error)
      set({
        error: error instanceof Error ? error.message : "Failed to load previous page",
        isLoading: false,
      })
    }
  },
}))

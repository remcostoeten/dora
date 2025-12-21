import { create } from "zustand"
import { db } from "@/services/database"
import { useTableView } from "./table-view"

type QueryState = {
  visible: boolean
  maximized: boolean
  query: string
  running: boolean
  dryRun: boolean
  hasErrors: boolean
  setVisible: (visible: boolean) => void
  setMaximized: (maximized: boolean) => void
  setQuery: (query: string) => void
  setDryRun: (dryRun: boolean) => void
  setHasErrors: (hasErrors: boolean) => void
  runQuery: () => void
}

export const useQuery = create<QueryState>((set, get) => ({
  visible: false,
  maximized: false,
  query: "SELECT * FROM users\nWHERE is_active = true\nLIMIT 100;",
  running: false,
  dryRun: false,
  hasErrors: false,

  setVisible: (visible) => set({ visible, maximized: visible ? get().maximized : false }),
  setMaximized: (maximized) => set({ maximized }),
  setQuery: (query) => set({ query }),
  setDryRun: (dryRun) => set({ dryRun }),
  setHasErrors: (hasErrors) => set({ hasErrors }),

  runQuery: async () => {
    const state = get()

    if (state.dryRun) {
      set({ running: true })
      console.log("[v0] Dry run mode - Query would be executed:", state.query)

      // Simulate API response structure for Tauri
      const dryRunResponse = {
        mode: "dry_run",
        query: state.query,
        estimatedRows: Math.floor(Math.random() * 1000),
        affectedTables: ["users"], // Mock data
        executionPlan: "Sequential Scan on users",
        warnings: [],
      }

      console.log("[v0] Dry run response:", dryRunResponse)

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500))
      set({ running: false })
      return
    }

    set({ running: true })
    try {
      const result = await db.query(get().query)

      const { setData, setColumns } = useTableView.getState()
      setData(result.rows)
      setColumns(
        result.columns.map((col) => ({
          name: col.name,
          type: col.type,
          isPrimary: col.isPrimary,
          isNullable: col.isNullable,
        })),
      )

      set({ running: false })
    } catch (error) {
      console.error("[v0] Query failed:", error)
      set({ running: false })
    }
  },
}))

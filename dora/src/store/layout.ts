import { create } from "zustand"
import { persist } from "zustand/middleware"

type LayoutState = {
  colWidths: Record<string, number>
  rowHeights: Record<number, number>
  setColWidth: (col: string, width: number) => void
  setRowHeight: (row: number, height: number) => void
  resetLayout: () => void
}

const MIN_WIDTH = 60
const MAX_WIDTH = 800
const MIN_HEIGHT = 24
const MAX_HEIGHT = 400

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      colWidths: {},
      rowHeights: {},

      setColWidth: (col, width) =>
        set((state) => ({
          colWidths: {
            ...state.colWidths,
            [col]: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
          },
        })),

      setRowHeight: (row, height) =>
        set((state) => ({
          rowHeights: {
            ...state.rowHeights,
            [row]: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height)),
          },
        })),

      resetLayout: () => set({ colWidths: {}, rowHeights: {} }),
    }),
    { name: "table-layout" },
  ),
)

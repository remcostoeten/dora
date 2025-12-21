import { create } from "zustand"

export type RowSelectionState = {
  // Selected row indices
  selectedRows: Set<number>
  // Last clicked row for shift-click range selection
  lastClickedRow: number | null

  // Actions
  selectRow: (rowIndex: number) => void
  toggleRow: (rowIndex: number) => void
  selectRange: (startRow: number, endRow: number) => void
  selectAll: (totalRows: number) => void
  clearSelection: () => void
  isSelected: (rowIndex: number) => boolean

  // Bulk operations
  getSelectedCount: () => number
  getSelectedRows: () => number[]
}

export const useRowSelection = create<RowSelectionState>((set, get) => ({
  selectedRows: new Set(),
  lastClickedRow: null,

  selectRow: (rowIndex) => {
    set({
      selectedRows: new Set([rowIndex]),
      lastClickedRow: rowIndex,
    })
  },

  toggleRow: (rowIndex) => {
    set((state) => {
      const newSet = new Set(state.selectedRows)
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex)
      } else {
        newSet.add(rowIndex)
      }
      return {
        selectedRows: newSet,
        lastClickedRow: rowIndex,
      }
    })
  },

  selectRange: (startRow, endRow) => {
    const start = Math.min(startRow, endRow)
    const end = Math.max(startRow, endRow)
    const newSet = new Set<number>()
    for (let i = start; i <= end; i++) {
      newSet.add(i)
    }
    set({
      selectedRows: newSet,
      lastClickedRow: endRow,
    })
  },

  selectAll: (totalRows) => {
    const newSet = new Set<number>()
    for (let i = 0; i < totalRows; i++) {
      newSet.add(i)
    }
    set({ selectedRows: newSet })
  },

  clearSelection: () => {
    set({
      selectedRows: new Set(),
      lastClickedRow: null,
    })
  },

  isSelected: (rowIndex) => {
    return get().selectedRows.has(rowIndex)
  },

  getSelectedCount: () => {
    return get().selectedRows.size
  },

  getSelectedRows: () => {
    return Array.from(get().selectedRows).sort((a, b) => a - b)
  },
}))

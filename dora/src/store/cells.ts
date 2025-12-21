import { create } from "zustand"
import type { CellInfo, CellChange } from "@/shared/types"

type CellsState = {
  selected: CellInfo | null
  changes: Map<string, CellChange>
  setSelected: (cell: CellInfo | null) => void
  updateCell: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
  applyChanges: () => void
  discardChanges: () => void
}

export const useCells = create<CellsState>((set) => ({
  selected: null,
  changes: new Map(),

  setSelected: (cell) => set({ selected: cell }),

  updateCell: (rowIndex, columnName, originalValue, newValue) => {
    set((state) => {
      const key = `${rowIndex}:${columnName}`
      const newChanges = new Map(state.changes)

      if (newValue === originalValue) {
        newChanges.delete(key)
      } else {
        newChanges.set(key, { rowIndex, columnName, originalValue, newValue })
      }

      return { changes: newChanges }
    })
  },

  applyChanges: () => {
    set((state) => {
      console.log("[v0] Applying changes:", Array.from(state.changes.values()))
      return { changes: new Map() }
    })
  },

  discardChanges: () => set({ changes: new Map() }),
}))

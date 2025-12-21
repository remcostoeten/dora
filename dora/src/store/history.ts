import { create } from "zustand"
import type { CellChange } from "@/shared/types"

type HistoryEntry = {
  changes: CellChange[]
  timestamp: number
}

type HistoryState = {
  past: HistoryEntry[]
  future: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  push: (changes: CellChange[]) => void
  undo: () => CellChange[] | null
  redo: () => CellChange[] | null
  clear: () => void
}

const MAX_HISTORY = 50

export const useHistory = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  push: (changes) => {
    if (changes.length === 0) return

    set((state) => {
      const newPast = [...state.past, { changes, timestamp: Date.now() }].slice(-MAX_HISTORY)
      return {
        past: newPast,
        future: [],
        canUndo: true,
        canRedo: false,
      }
    })
  },

  undo: () => {
    const { past } = get()
    if (past.length === 0) return null

    const entry = past[past.length - 1]
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [entry, ...state.future],
      canUndo: state.past.length > 1,
      canRedo: true,
    }))

    return entry.changes
  },

  redo: () => {
    const { future } = get()
    if (future.length === 0) return null

    const entry = future[0]
    set((state) => ({
      past: [...state.past, entry],
      future: state.future.slice(1),
      canUndo: true,
      canRedo: state.future.length > 1,
    }))

    return entry.changes
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}))

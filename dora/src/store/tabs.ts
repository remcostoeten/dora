import { create } from "zustand"
import type { Tab, TabType } from "@/shared/types"

type TabsState = {
  tabs: Tab[]
  activeId: string
  addTab: (type: TabType, name?: string) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  reorderTabs: (tabs: Tab[]) => void
  closeAll: () => void
  closeLeft: (id: string) => void
  closeRight: (id: string) => void
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [
    { id: "1", name: "users", type: "table" },
    { id: "2", name: "orders", type: "table" },
  ],
  activeId: "1",

  addTab: (type, name) => {
    const newTab: Tab = {
      id: Date.now().toString(),
      name: name || (type === "query" ? "New Query" : "new_table"),
      type,
    }
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeId: newTab.id,
    }))
  },

  closeTab: (id) => {
    const { tabs, activeId } = get()
    const newTabs = tabs.filter((t) => t.id !== id)

    if (newTabs.length === 0) {
      get().addTab("table")
      return
    }

    const updates: Partial<TabsState> = { tabs: newTabs }
    if (activeId === id) {
      updates.activeId = newTabs[newTabs.length - 1].id
    }

    set(updates)
  },

  setActive: (id) => set({ activeId: id }),

  reorderTabs: (tabs) => set({ tabs }),

  closeAll: () => {
    set({ tabs: [], activeId: "" })
  },

  closeLeft: (id) => {
    const { tabs, activeId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx <= 0) return

    const newTabs = tabs.slice(idx)
    const updates: Partial<TabsState> = { tabs: newTabs }

    if (!newTabs.find((t) => t.id === activeId)) {
      updates.activeId = newTabs[0].id
    }

    set(updates)
  },

  closeRight: (id) => {
    const { tabs, activeId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1 || idx === tabs.length - 1) return

    const newTabs = tabs.slice(0, idx + 1)
    const updates: Partial<TabsState> = { tabs: newTabs }

    if (!newTabs.find((t) => t.id === activeId)) {
      updates.activeId = newTabs[newTabs.length - 1].id
    }

    set(updates)
  },
}))

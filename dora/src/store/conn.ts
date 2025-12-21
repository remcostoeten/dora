import { create } from "zustand"
import { conn } from "@/services/connection"
import type { ConnStatus } from "@/services/connection"

type ConnState = {
  conns: ConnStatus[]
  active: string | null
  loading: boolean
  error: string | null
  loadConns: () => Promise<void>
  setActive: (id: string) => void
}

export const useConn = create<ConnState>((set, get) => ({
  conns: [],
  active: null,
  loading: false,
  error: null,

  loadConns: async () => {
    set({ loading: true, error: null })
    try {
      const conns = await conn.list()
      set({ conns, loading: false })
    } catch (error) {
      set({ error: String(error), loading: false })
    }
  },

  setActive: (id) => {
    conn.setActive(id)
    set({ active: id })
  },
}))

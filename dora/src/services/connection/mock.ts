import type { ConnService, ConnStatus } from "./types"

const mockConns = new Map<string, ConnStatus>()
let activeId: string | null = null

export const mockConn: ConnService = {
  test: async (config) => {
    await delay(200)
    console.log("[v0] Mock test connection:", config)
    return true
  },

  connect: async (config) => {
    await delay(300)
    const id = crypto.randomUUID()

    mockConns.set(id, {
      id,
      name: config.name,
      type: config.type,
      connected: true,
      lastUsed: new Date(),
    })

    console.log("[v0] Mock connected:", id, config)
    return id
  },

  disconnect: async (id) => {
    await delay(100)
    const conn = mockConns.get(id)
    if (conn) {
      conn.connected = false
      mockConns.set(id, conn)
    }
    console.log("[v0] Mock disconnected:", id)
  },

  list: async () => {
    await delay(50)
    return Array.from(mockConns.values())
  },

  remove: async (id) => {
    await delay(100)
    mockConns.delete(id)
    console.log("[v0] Mock removed connection:", id)
  },

  setActive: (id) => {
    activeId = id
    if (typeof window !== "undefined") {
      localStorage.setItem("activeConnectionId", id)
    }
  },

  getActive: () => {
    if (!activeId && typeof window !== "undefined") {
      activeId = localStorage.getItem("activeConnectionId")
    }
    return activeId
  },
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

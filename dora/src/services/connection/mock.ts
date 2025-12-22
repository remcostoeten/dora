import type { ConnService, ConnStatus } from "./types"

export const DEMO_CONNECTION_ID = "demo-connection"

const mockConns = new Map<string, ConnStatus>()
let activeId: string | null = DEMO_CONNECTION_ID // Auto-set demo as active

// Pre-populate with demo connection (already connected)
mockConns.set(DEMO_CONNECTION_ID, {
  id: DEMO_CONNECTION_ID,
  name: "Demo Database",
  type: "postgres",
  connected: true, // Start connected on web
  isDemo: true,
  lastUsed: new Date(),
})

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
    // On web, always default to demo connection for instant UX
    if (!activeId) {
      activeId = DEMO_CONNECTION_ID
    }
    return activeId
  },
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

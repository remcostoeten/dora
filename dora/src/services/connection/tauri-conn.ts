import { invoke } from "@tauri-apps/api/core"
import type { ConnService, ConnConfig, ConnStatus } from "./types"
import type { ConnInfo, DbInfo } from "../database/tauri-types"

export const tauriConn: ConnService = {
  test: async (config) => {
    const dbInfo = mapToDbInfo(config)
    return await invoke<boolean>("test_connection", { databaseInfo: dbInfo })
  },

  connect: async (config) => {
    const dbInfo = mapToDbInfo(config)
    const result = await invoke<ConnInfo>("add_connection", {
      name: config.name,
      databaseInfo: dbInfo,
    })

    await invoke<boolean>("connect_to_database", {
      connectionId: result.id,
    })

    return result.id
  },

  disconnect: async (id) => {
    await invoke("disconnect_from_database", { connectionId: id })
  },

  list: async () => {
    const conns = await invoke<ConnInfo[]>("get_connections")
    return conns.map(mapToStatus)
  },

  remove: async (id) => {
    await invoke("remove_connection", { connectionId: id })
  },

  setActive: (id) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeConnectionId", id)
    }
  },

  getActive: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeConnectionId")
    }
    return null
  },
}

function mapToDbInfo(config: ConnConfig): DbInfo {
  if (config.type === "postgres") {
    const parts = []
    if (config.username) parts.push(`${config.username}${config.password ? `:${config.password}` : ""}@`)
    if (config.host) parts.push(`${config.host}${config.port ? `:${config.port}` : ""}`)
    if (config.database) parts.push(`/${config.database}`)

    const connStr = `postgres://${parts.join("")}`
    return { Postgres: { connection_string: connStr } }
  }

  if (config.type === "sqlite") {
    return { SQLite: { db_path: config.filepath || "" } }
  }

  throw new Error(`Unsupported database type: ${config.type}`)
}

function mapToStatus(conn: ConnInfo): ConnStatus {
  let type: "postgres" | "sqlite" | "libsql" = "sqlite"

  if ("Postgres" in conn.database_type) {
    type = "postgres"
  } else if ("SQLite" in conn.database_type) {
    type = "sqlite"
  }

  return {
    id: conn.id,
    name: conn.name,
    type,
    connected: conn.connected,
    lastUsed: conn.last_connected_at ? new Date(conn.last_connected_at * 1000) : undefined,
    favorite: conn.favorite,
    color: conn.color,
  }
}

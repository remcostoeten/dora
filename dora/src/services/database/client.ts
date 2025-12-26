import { mockClient } from "./mock"
import { tauriClient } from "./tauri-client"
import { isTauri } from "@/shared/utils"
import type { DbClient } from "./types"

export function getClient(): DbClient {
  return isTauri() ? tauriClient : mockClient
}

// Lazy getter using Proxy to avoid build-time evaluation
// During SSG, window is undefined so isTauri() returns false
// This would bake mockClient into the static HTML, showing demo data in Tauri
let _db: DbClient | null = null
export const db: DbClient = new Proxy({} as DbClient, {
  get(_, prop: keyof DbClient) {
    if (!_db) _db = getClient()
    return (_db as any)[prop]
  }
})

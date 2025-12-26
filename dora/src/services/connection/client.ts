import { mockConn } from "./mock"
import { tauriConn } from "./tauri-conn"
import { isTauri } from "@/shared/utils"
import type { ConnService } from "./types"

export function getConn(): ConnService {
  return isTauri() ? tauriConn : mockConn
}

// Lazy getter using Proxy to avoid build-time evaluation
// During SSG, window is undefined so isTauri() returns false
// This would bake mockConn into the static HTML, showing demo labels in Tauri
let _conn: ConnService | null = null
export const conn: ConnService = new Proxy({} as ConnService, {
  get(_, prop: keyof ConnService) {
    if (!_conn) _conn = getConn()
    return (_conn as any)[prop]
  }
})

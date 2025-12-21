import { mockConn } from "./mock"
import { tauriConn } from "./tauri-conn"
import { isTauri } from "@/shared/utils"
import type { ConnService } from "./types"

export function getConn(): ConnService {
  return isTauri() ? tauriConn : mockConn
}

export const conn = getConn()

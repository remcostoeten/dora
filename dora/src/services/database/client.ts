import { mockClient } from "./mock"
import { tauriClient } from "./tauri-client"
import { isTauri } from "@/shared/utils"
import type { DbClient } from "./types"

export function getClient(): DbClient {
  return isTauri() ? tauriClient : mockClient
}

export const db = getClient()

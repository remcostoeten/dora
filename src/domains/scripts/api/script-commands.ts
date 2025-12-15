import type { Script } from '../types'

export async function getScripts(): Promise<Script[]> {
  // This will be implemented with Tauri commands
  return []
}

export async function saveScript(script: Omit<Script, 'id' | 'created_at' | 'updated_at'>): Promise<Script> {
  // This will be implemented with Tauri commands
  return {
    ...script,
    id: Date.now(),
    created_at: Date.now() / 1000,
    updated_at: Date.now() / 1000,
  }
}

export async function updateScript(id: number, updates: Partial<Script>): Promise<Script> {
  // This will be implemented with Tauri commands
  throw new Error('Not implemented')
}

export async function deleteScript(id: number): Promise<void> {
  // This will be implemented with Tauri commands
}

import { invoke } from '@tauri-apps/api/core'
import type { CommandDefinition, StoredShortcut } from '@/types/commands'

export async function getAllCommands(): Promise<CommandDefinition[]> {
    return await invoke('get_all_commands')
}

export async function getCommand(commandId: string): Promise<CommandDefinition | null> {
    return await invoke('get_command', { commandId })
}

export async function updateCommandShortcut(
    commandId: string,
    keys: string[] | null
): Promise<void> {
    return await invoke('update_command_shortcut', { commandId, keys })
}

export async function getCustomShortcuts(): Promise<StoredShortcut[]> {
    return await invoke('get_custom_shortcuts')
}

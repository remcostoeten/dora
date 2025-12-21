export interface ShortcutDefinition {
    keys: string[]
    enabled: boolean
}

export interface CommandDefinition {
    id: string
    name: string
    description: string
    category: string
    shortcut?: ShortcutDefinition
}

export interface StoredShortcut {
    command_id: string
    keys: string[]
    enabled: boolean
    created_at: number
    updated_at: number
}

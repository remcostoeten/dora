import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CommandDefinition } from '@/types/commands'
import { getAllCommands } from '@/core/tauri/command-api'

interface CommandUsage {
    lastUsed: number
    count: number
}

interface CommandStore {
    commands: CommandDefinition[]
    isOpen: boolean
    searchQuery: string
    usageHistory: Record<string, CommandUsage>

    // Actions
    setIsOpen: (isOpen: boolean) => void
    setSearchQuery: (query: string) => void
    loadCommands: () => Promise<void>
    getCommand: (id: string) => CommandDefinition | undefined
    trackCommandUsage: (id: string) => void

    // Handlers
    handlers: Record<string, () => void | Promise<void>>
    registerHandler: (id: string, handler: () => void | Promise<void>) => () => void
    getHandler: (id: string) => (() => void | Promise<void>) | undefined
}

export const useCommandStore = create<CommandStore>()(
    persist(
        (set, get) => ({
            commands: [],
            isOpen: false,
            searchQuery: '',
            usageHistory: {},

            setIsOpen: (isOpen) => set({ isOpen }),
            setSearchQuery: (searchQuery) => set({ searchQuery }),

            loadCommands: async () => {
                try {
                    const commands = await getAllCommands()
                    // console.log('[useCommandStore] Loaded commands:', commands)
                    set({ commands })
                } catch (error) {
                    console.error('[useCommandStore] Failed to load commands:', error)
                }
            },

            getCommand: (id) => get().commands.find(c => c.id === id),

            trackCommandUsage: (id) => set((state) => {
                const current = state.usageHistory[id] || { lastUsed: 0, count: 0 }
                return {
                    usageHistory: {
                        ...state.usageHistory,
                        [id]: {
                            lastUsed: Date.now(),
                            count: current.count + 1
                        }
                    }
                }
            }),

            // Handler Registry
            handlers: {},
            registerHandler: (id, handler) => {
                set((state) => ({
                    handlers: {
                        ...state.handlers,
                        [id]: handler
                    }
                }))
                // Return cleanup function
                return () => {
                    set((state) => {
                        // Only remove if it's the specific handler we registered
                        // (Handle cases where a new handler might have replaced it immediately)
                        if (state.handlers[id] === handler) {
                            const newHandlers = { ...state.handlers }
                            delete newHandlers[id]
                            return { handlers: newHandlers }
                        }
                        return state
                    })
                }
            },
            getHandler: (id) => get().handlers[id],
        }),
        {
            name: 'command-store',
            partialize: (state) => ({ usageHistory: state.usageHistory }), // Only persist history
        }
    )
)

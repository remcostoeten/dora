import { useEffect, useCallback } from 'react'
import { useCommandStore } from '@/core/state/commands'
import { COMMAND_IDS } from '@/core/commands/constants'

type CommandHandler = () => void | Promise<void>

export function useCommands() {
    const { commands, loadCommands, setIsOpen, isOpen, trackCommandUsage, getHandler, registerHandler } = useCommandStore()


    // Execute a command by ID
    const executeCommand = useCallback(async (commandId: string) => {
        console.log(`Executing command: ${commandId}`)

        // Built-in handlers
        if (commandId === COMMAND_IDS.PALETTE_OPEN) {
            setIsOpen(true)
            trackCommandUsage(commandId)
            return
        }

        const handler = getHandler(commandId)
        if (handler) {
            try {
                await handler()
                trackCommandUsage(commandId)
            } catch (error) {
                console.error(`Error executing command ${commandId}:`, error)
            }
        } else {
            console.warn(`No handler registered for command: ${commandId}`)
        }

        // Close palette after execution (unless it's the palette open command itself)
        if (commandId !== COMMAND_IDS.PALETTE_OPEN) {
            setIsOpen(false)
        }
    }, [setIsOpen, trackCommandUsage])

    // Initial load
    useEffect(() => {
        loadCommands()
    }, [loadCommands])

    // Global keyboard listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if inside input/textarea (except for specific global shortcuts like Ctrl+P)
            const target = e.target as HTMLElement
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

            // Construct key combo
            const keys: string[] = []
            if (e.ctrlKey) keys.push('Ctrl')
            if (e.metaKey) keys.push('Cmd') // Map Meta to Cmd for consistency or handled by backend logic
            if (e.altKey) keys.push('Alt')
            if (e.shiftKey) keys.push('Shift')

            // Standardize key name
            let key = e.key
            if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return
            if (key === ' ') key = 'Space'

            // Capitalize first letter
            if (key.length === 1) key = key.toUpperCase()

            keys.push(key)

            // Normalize for matching: Sort modifiers, then key

            // Debug logging
            console.log('[useCommands] KeyDown:', key, 'Keys:', keys)

            const matchedCommand = commands.find(cmd => {
                if (!cmd.shortcut?.enabled) return false

                const cmdKeys = cmd.shortcut.keys
                if (cmdKeys.length !== keys.length) return false

                const setA = new Set(cmdKeys.map(k => k.toLowerCase().replace('command', 'cmd'))) // normalize
                const setB = new Set(keys.map(k => k.toLowerCase().replace('meta', 'cmd')))

                if (setA.size !== setB.size) return false
                for (const k of setA) {
                    if (!setB.has(k)) return false
                }
                return true
            })

            console.log('[useCommands] Matched:', matchedCommand?.id)

            if (matchedCommand) {
                // If it's an input and the command isn't a "global" navigation command, maybe skip?
                if (isInput && keys.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    return
                }

                e.preventDefault()
                e.stopPropagation()
                executeCommand(matchedCommand.id)
            }
        }

        window.addEventListener('keydown', handleKeyDown, { capture: true })
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }, [commands, executeCommand])

    return {
        registerHandler,
        executeCommand
    }
}

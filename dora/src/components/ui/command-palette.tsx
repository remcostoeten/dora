'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Command, ArrowRight } from 'lucide-react'
import { useCommandStore } from '@/core/state/commands'
import { useCommands } from '@/core/hooks/use-commands'
import { CommandDefinition, ShortcutDefinition } from '@/types/commands'
import { cn } from '@/core/utilities/cn'

export function CommandPalette() {
    const { isOpen, setIsOpen, commands, searchQuery, setSearchQuery, usageHistory } = useCommandStore()
    const { executeCommand } = useCommands()
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Filter commands based on search
    const filteredCommands = useMemo(() => {
        // If no search, show recently used first, then others
        if (!searchQuery) {
            const withHistory = commands.map(cmd => ({
                ...cmd,
                lastUsed: usageHistory[cmd.id]?.lastUsed || 0
            }))

            return withHistory
                .sort((a, b) => b.lastUsed - a.lastUsed)
                .slice(0, 10)
        }

        const lowerQuery = searchQuery.toLowerCase()
        return commands
            .filter(cmd =>
                cmd.name.toLowerCase().includes(lowerQuery) ||
                cmd.description.toLowerCase().includes(lowerQuery) ||
                cmd.category.toLowerCase().includes(lowerQuery)
            )
            .map(cmd => ({
                ...cmd,
                // Simple score: 1 base, + usage boost
                score: 1 + (usageHistory[cmd.id]?.count || 0) * 0.1
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 50)
    }, [commands, searchQuery, usageHistory])

    // Reset selection on search change
    useEffect(() => {
        setSelectedIndex(0)
    }, [searchQuery])

    // Handle keyboard navigation within the palette
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (filteredCommands.length > 0) {
                    setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
            } else if (e.key === 'Enter') {
                e.preventDefault()
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex].id)
                }
            } else if (e.key === 'Escape') {
                e.preventDefault()
                setIsOpen(false)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, filteredCommands, selectedIndex, executeCommand, setIsOpen])

    if (!isOpen) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.1 }}
                        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
                    >
                        <div className="flex items-center border-b border-border px-4 py-3">
                            <Search className="mr-3 h-5 w-5 text-muted-foreground" />
                            <input
                                autoFocus
                                className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                                placeholder="Type a command or search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="flex items-center gap-1">
                                <kbd className="hidden sm:inline-block rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                                    ESC
                                </kbd>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto py-2">
                            {filteredCommands.length === 0 ? (
                                <div className="px-4 py-8 text-center text-muted-foreground">
                                    No commands found.
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {/* Group by category if needed, for now flat list */}
                                    {filteredCommands.map((cmd, index) => (
                                        <CommandItem
                                            key={cmd.id}
                                            command={cmd}
                                            isSelected={index === selectedIndex}
                                            onClick={() => executeCommand(cmd.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground flex justify-between">
                            <span>
                                <b className="text-foreground">{filteredCommands.length}</b> commands
                            </span>
                            <div className="flex gap-3">
                                <span>Use <kbd className="font-mono">↑↓</kbd> to navigate</span>
                                <span><kbd className="font-mono">Enter</kbd> to execute</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function CommandItem({
    command,
    isSelected,
    onClick
}: {
    command: CommandDefinition
    isSelected: boolean
    onClick: () => void
}) {
    const itemRef = useRef<HTMLDivElement>(null)

    // Auto-scroll into view
    useEffect(() => {
        if (isSelected && itemRef.current) {
            itemRef.current.scrollIntoView({ block: 'nearest' })
        }
    }, [isSelected])

    return (
        <div
            ref={itemRef}
            className={cn(
                "mx-2 flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors",
                isSelected ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted/50"
            )}
            onClick={onClick}
            onMouseEnter={() => {
                // Optional: set selected index on hover if desired, 
                // usually avoided in keyboard-centric UIs to prevent jumping
            }}
        >
            <div className="flex items-center gap-3">
                {/* Could add icon based on category here */}
                <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background",
                    isSelected && "border-accent-foreground/20 bg-accent-foreground/5"
                )}>
                    <Command className="h-4 w-4 opacity-70" />
                </div>

                <div className="flex flex-col">
                    <span className="font-medium">{command.name}</span>
                    <span className={cn(
                        "text-xs truncate max-w-[300px]",
                        isSelected ? "text-accent-foreground/70" : "text-muted-foreground"
                    )}>{command.description}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {command.shortcut?.enabled && (
                    <ShortcutKeys keys={command.shortcut.keys} />
                )}
            </div>
        </div>
    )
}

function ShortcutKeys({ keys }: { keys: string[] }) {
    return (
        <div className="flex items-center gap-1">
            {keys.map((key, i) => (
                <React.Fragment key={i}>
                    <kbd className="min-w-[20px] rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground text-center">
                        {key}
                    </kbd>
                    {i < keys.length - 1 && <span className="text-muted-foreground/40 text-xs">+</span>}
                </React.Fragment>
            ))}
        </div>
    )
}

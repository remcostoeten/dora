'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    prettifyCode,
    prettifySQL,
    minifySQL,
    type SupportedLanguage,
} from '@/core/formatters'
import { Wand2, ChevronDown, Minimize2, Code2, Database, FileJson, Play } from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { populateTestQueries } from '@/core/tauri'
import { useToast } from '@/components/ui/toast'

type EditorToolbarProps = {
    /** Current content of the editor */
    content: string
    /** Callback when content is formatted */
    onFormat: (formattedContent: string) => void
    /** Optional: current language hint */
    language?: SupportedLanguage
    /** Optional: show compact version */
    compact?: boolean
    /** Optional: additional class names */
    className?: string
}

export function EditorToolbar({
    content,
    onFormat,
    language = 'sql',
    compact = false,
    className,
}: EditorToolbarProps) {
    const [isFormatting, setIsFormatting] = useState(false)
    const [lastResult, setLastResult] = useState<{ success: boolean; message?: string } | null>(null)
    const { addToast } = useToast()

    const handlePopulateTestQueries = useCallback(async () => {
        try {
            const result = await populateTestQueries()
            addToast({
                title: 'Test Queries Added',
                description: result,
                variant: 'default'
            })
        } catch (error) {
            addToast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to populate test queries',
                variant: 'error'
            })
        }
    }, [addToast])

    const handleFormat = useCallback(
        async (targetLanguage?: SupportedLanguage) => {
            setIsFormatting(true)
            setLastResult(null)

            try {
                const result = prettifyCode(content, targetLanguage || language)

                if (result.success) {
                    onFormat(result.formatted)
                    setLastResult({ success: true })
                } else {
                    setLastResult({ success: false, message: result.error })
                }
            } catch (error) {
                setLastResult({
                    success: false,
                    message: error instanceof Error ? error.message : 'Formatting failed',
                })
            } finally {
                setIsFormatting(false)
            }
        },
        [content, language, onFormat]
    )

    const handleMinify = useCallback(() => {
        setIsFormatting(true)
        setLastResult(null)

        try {
            const result = minifySQL(content)

            if (result.success) {
                onFormat(result.formatted)
                setLastResult({ success: true })
            } else {
                setLastResult({ success: false, message: result.error })
            }
        } catch (error) {
            setLastResult({
                success: false,
                message: error instanceof Error ? error.message : 'Minification failed',
            })
        } finally {
            setIsFormatting(false)
        }
    }, [content, onFormat])

    const handleFormatAsSQL = useCallback(() => {
        setIsFormatting(true)
        setLastResult(null)

        try {
            const result = prettifySQL(content)

            if (result.success) {
                onFormat(result.formatted)
                setLastResult({ success: true })
            } else {
                setLastResult({ success: false, message: result.error })
            }
        } catch (error) {
            setLastResult({
                success: false,
                message: error instanceof Error ? error.message : 'Formatting failed',
            })
        } finally {
            setIsFormatting(false)
        }
    }, [content, onFormat])

    if (compact) {
        return (
            <div className={className}>
                <DropdownMenu>
                    <Tooltip content="Format code" side="bottom">
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={isFormatting || !content.trim()}
                            >
                                <Wand2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Format code</span>
                            </Button>
                        </DropdownMenuTrigger>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Format Code</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleFormat()}>
                            <Wand2 className="mr-2 h-4 w-4" />
                            Auto Format
                            <DropdownMenuShortcut>⇧⌥F</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleFormatAsSQL}>
                            <Database className="mr-2 h-4 w-4" />
                            Format as SQL
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFormat('json')}>
                            <FileJson className="mr-2 h-4 w-4" />
                            Format as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleFormat('yaml')}>
                            <Code2 className="mr-2 h-4 w-4" />
                            Format as YAML
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleMinify}>
                            <Minimize2 className="mr-2 h-4 w-4" />
                            Minify SQL
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )
    }

    return (
        <div className={`flex items-center gap-1 ${className || ''}`}>
            {/* Main format button */}
            <Tooltip content="Format code (Shift+Alt+F)" side="bottom">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFormat()}
                    disabled={isFormatting || !content.trim()}
                    className="h-7 px-2 text-xs"
                >
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Format
                </Button>
            </Tooltip>

            {/* Dropdown for more options */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={isFormatting || !content.trim()}
                    >
                        <ChevronDown className="h-3.5 w-3.5" />
                        <span className="sr-only">More format options</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Format As</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleFormatAsSQL}>
                        <Database className="mr-2 h-4 w-4" />
                        SQL (PostgreSQL)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleFormat('json')}>
                        <FileJson className="mr-2 h-4 w-4" />
                        JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleFormat('yaml')}>
                        <Code2 className="mr-2 h-4 w-4" />
                        YAML
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleMinify}>
                        <Minimize2 className="mr-2 h-4 w-4" />
                        Minify SQL
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Test queries button */}
            <Tooltip content="Populate test queries (CRUD examples)" side="bottom">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePopulateTestQueries}
                    className="h-7 px-2 text-xs"
                >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Test Queries
                </Button>
            </Tooltip>

            {/* Status indicator */}
            {lastResult && (
                <span
                    className={`ml-1 text-xs ${lastResult.success ? 'text-green-500' : 'text-destructive'
                        }`}
                >
                    {lastResult.success ? '✓' : '✗'}
                </span>
            )}
        </div>
    )
}

// ============================================================================
// Keyboard Shortcut Hook for Format
// ============================================================================

type UseFormatShortcutOptions = {
    content: string
    onFormat: (formattedContent: string) => void
    language?: SupportedLanguage
    enabled?: boolean
}

/**
 * Hook to enable Shift+Alt+F keyboard shortcut for formatting
 */
export function useFormatShortcut({
    content,
    onFormat,
    language = 'sql',
    enabled = true,
}: UseFormatShortcutOptions) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Shift+Alt+F (or Shift+Option+F on Mac)
            if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'f') {
                event.preventDefault()

                const result = prettifyCode(content, language)
                if (result.success) {
                    onFormat(result.formatted)
                }
            }
        },
        [content, language, onFormat]
    )

    // Use effect to add/remove event listener
    if (typeof window !== 'undefined' && enabled) {
        // This would typically be in a useEffect, but keeping it simple for demonstration
        // The actual implementation in the editor component should use useEffect
    }

    return handleKeyDown
}

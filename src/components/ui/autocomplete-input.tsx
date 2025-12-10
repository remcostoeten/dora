'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type Suggestion = {
    value: string
    label?: string
    description?: string
}

export interface AutocompleteInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onSelect'> {
    value: string
    onChange: (value: string) => void
    suggestions: Suggestion[]
    /** Show ghost text inline for the first matching suggestion */
    showInlineGhost?: boolean
    /** Called when a suggestion is selected */
    onSuggestionSelect?: (suggestion: Suggestion) => void
    /** Placeholder when no suggestions */
    emptyMessage?: string
}

export function AutocompleteInput({
    value,
    onChange,
    suggestions,
    showInlineGhost = true,
    onSuggestionSelect,
    emptyMessage = 'No suggestions',
    className,
    disabled,
    ...props
}: AutocompleteInputProps) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const listRef = React.useRef<HTMLUListElement>(null)
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedIndex, setSelectedIndex] = React.useState(-1)
    const [ghostText, setGhostText] = React.useState('')

    // Filter suggestions based on current input
    const filteredSuggestions = React.useMemo(() => {
        if (!value.trim()) return suggestions.slice(0, 10)
        const lower = value.toLowerCase()
        return suggestions
            .filter(s => s.value.toLowerCase().includes(lower) || s.value.toLowerCase().startsWith(lower))
            .slice(0, 10)
    }, [value, suggestions])

    // Update ghost text based on first matching suggestion
    React.useEffect(() => {
        if (!showInlineGhost || !value.trim() || filteredSuggestions.length === 0) {
            setGhostText('')
            return
        }

        const firstMatch = filteredSuggestions.find(s =>
            s.value.toLowerCase().startsWith(value.toLowerCase())
        )

        if (firstMatch && firstMatch.value.toLowerCase() !== value.toLowerCase()) {
            // Show the remaining part of the suggestion as ghost text
            setGhostText(firstMatch.value.slice(value.length))
        } else {
            setGhostText('')
        }
    }, [value, filteredSuggestions, showInlineGhost])

    // Scroll selected item into view
    React.useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const item = listRef.current.children[selectedIndex] as HTMLElement
            item?.scrollIntoView({ block: 'nearest' })
        }
    }, [selectedIndex])

    const acceptGhostText = React.useCallback(() => {
        if (ghostText) {
            const newValue = value + ghostText
            onChange(newValue)
            setGhostText('')
            return true
        }
        return false
    }, [ghostText, value, onChange])

    const selectSuggestion = React.useCallback((suggestion: Suggestion) => {
        onChange(suggestion.value)
        onSuggestionSelect?.(suggestion)
        setIsOpen(false)
        setSelectedIndex(-1)
        setGhostText('')
        inputRef.current?.focus()
    }, [onChange, onSuggestionSelect])

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
            case 'Tab':
                // Accept ghost text or first suggestion
                if (ghostText) {
                    e.preventDefault()
                    acceptGhostText()
                } else if (isOpen && filteredSuggestions.length > 0) {
                    e.preventDefault()
                    selectSuggestion(filteredSuggestions[0])
                }
                break

            case 'ArrowDown':
                e.preventDefault()
                if (!isOpen) {
                    setIsOpen(true)
                    setSelectedIndex(0)
                } else {
                    setSelectedIndex(prev =>
                        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
                    )
                }
                break

            case 'ArrowUp':
                e.preventDefault()
                if (isOpen) {
                    setSelectedIndex(prev =>
                        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
                    )
                }
                break

            case 'Enter':
                if (isOpen && selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
                    e.preventDefault()
                    selectSuggestion(filteredSuggestions[selectedIndex])
                }
                break

            case 'Escape':
                if (isOpen) {
                    e.preventDefault()
                    setIsOpen(false)
                    setSelectedIndex(-1)
                }
                break

            case 'ArrowRight':
                // Accept ghost text when cursor is at end
                if (ghostText && inputRef.current?.selectionStart === value.length) {
                    e.preventDefault()
                    acceptGhostText()
                }
                break
        }
    }, [ghostText, isOpen, selectedIndex, filteredSuggestions, acceptGhostText, selectSuggestion, value.length])

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
        setSelectedIndex(-1)
        if (!isOpen && e.target.value) {
            setIsOpen(true)
        }
    }, [onChange, isOpen])

    const handleFocus = React.useCallback(() => {
        if (filteredSuggestions.length > 0) {
            setIsOpen(true)
        }
    }, [filteredSuggestions.length])

    const handleBlur = React.useCallback((e: React.FocusEvent) => {
        // Delay to allow click on suggestions
        setTimeout(() => {
            if (!listRef.current?.contains(document.activeElement)) {
                setIsOpen(false)
                setSelectedIndex(-1)
            }
        }, 150)
    }, [])

    return (
        <div className="relative w-full">
            {/* Input wrapper with ghost text overlay */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    disabled={disabled}
                    className={cn(
                        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                        'ring-offset-background placeholder:text-muted-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        className
                    )}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls="autocomplete-listbox"
                    aria-autocomplete="both"
                    autoComplete="off"
                    {...props}
                />

                {/* Ghost text overlay */}
                {showInlineGhost && ghostText && (
                    <div
                        className="pointer-events-none absolute inset-0 flex items-center px-3 py-2 text-sm"
                        aria-hidden="true"
                    >
                        <span className="invisible">{value}</span>
                        <span className="text-muted-foreground/50">{ghostText}</span>
                    </div>
                )}
            </div>

            {/* Dropdown suggestions */}
            {isOpen && (
                <ul
                    ref={listRef}
                    id="autocomplete-listbox"
                    role="listbox"
                    className={cn(
                        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border',
                        'bg-popover p-1 text-popover-foreground shadow-md',
                        'animate-in fade-in-0 zoom-in-95'
                    )}
                >
                    {filteredSuggestions.length === 0 ? (
                        <li className="px-2 py-1.5 text-sm text-muted-foreground">
                            {emptyMessage}
                        </li>
                    ) : (
                        filteredSuggestions.map((suggestion, index) => (
                            <li
                                key={suggestion.value}
                                role="option"
                                aria-selected={index === selectedIndex}
                                className={cn(
                                    'flex cursor-pointer select-none flex-col rounded-sm px-2 py-1.5 text-sm outline-none',
                                    'transition-colors',
                                    index === selectedIndex
                                        ? 'bg-accent text-accent-foreground'
                                        : 'hover:bg-accent hover:text-accent-foreground'
                                )}
                                onClick={() => selectSuggestion(suggestion)}
                                onMouseEnter={() => setSelectedIndex(index)}
                            >
                                <span className="font-medium">{suggestion.label || suggestion.value}</span>
                                {suggestion.description && (
                                    <span className="text-xs text-muted-foreground">{suggestion.description}</span>
                                )}
                            </li>
                        ))
                    )}

                    {/* Keyboard hint */}
                    <li className="border-t border-border mt-1 pt-1 px-2 py-1 text-xs text-muted-foreground flex gap-2">
                        <span><kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate</span>
                        <span><kbd className="px-1 bg-muted rounded">Tab</kbd> accept</span>
                        <span><kbd className="px-1 bg-muted rounded">Enter</kbd> select</span>
                        <span><kbd className="px-1 bg-muted rounded">Esc</kbd> close</span>
                    </li>
                </ul>
            )}
        </div>
    )
}

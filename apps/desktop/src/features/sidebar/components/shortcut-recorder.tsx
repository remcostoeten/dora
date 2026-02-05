import { X, RotateCcw, Keyboard } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { formatShortcut } from '@/core/shortcuts'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'

type Props = {
    value: string | string[]
    onChange: (value: string) => void
    onReset: () => void
    isDefault: boolean
}

export function ShortcutRecorder({ value, onChange, onReset, isDefault }: Props) {
    const [isRecording, setIsRecording] = useState(false)
    const [tempCombo, setTempCombo] = useState<string | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(function () {
        if (!isRecording) return

        function handleKeyDown(e: KeyboardEvent) {
            e.preventDefault()
            e.stopPropagation()

            // Ignore standalone (non-modifier) key releases or just plain modifiers being pressed
            if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'ContextMenu'].includes(e.key)) {
                return
            }

            const modifiers: string[] = []
            if (e.ctrlKey) modifiers.push('ctrl')
            if (e.metaKey) modifiers.push('mod') // map meta to mod for cross-platform
            if (e.altKey) modifiers.push('alt')
            if (e.shiftKey) modifiers.push('shift')

            let key = e.key.toLowerCase()

            // Map special keys
            if (key === ' ') key = 'space'
            if (key === 'escape') key = 'escape'
            if (key === 'arrowup') key = 'up'
            if (key === 'arrowdown') key = 'down'
            if (key === 'arrowleft') key = 'left'
            if (key === 'arrowright') key = 'right'

            const combo = [...modifiers, key].join('+')
            setTempCombo(combo)
        }

        function handleKeyUp(e: KeyboardEvent) {
            if (tempCombo) {
                onChange(tempCombo)
                setIsRecording(false)
                setTempCombo(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return function () {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [isRecording, tempCombo, onChange])

    // Handle clicking outside to cancel
    useEffect(function () {
        if (!isRecording) return

        function handleClickOutside(e: MouseEvent) {
            if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsRecording(false)
                setTempCombo(null)
            }
        }

        window.addEventListener('mousedown', handleClickOutside)
        return function () {
            window.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isRecording])

    const displayValue = tempCombo || (Array.isArray(value) ? value[0] : value)
    const formatted = formatShortcut(displayValue || '')

    return (
        <div className='flex items-center gap-2'>
            <Button
                ref={buttonRef}
                variant={isRecording ? 'destructive' : 'outline'}
                size='sm'
                className={cn(
                    'min-w-[120px] justify-between font-mono text-xs',
                    isRecording && 'animate-pulse'
                )}
                onClick={function () { setIsRecording(true) }}
            >
                {isRecording ? (
                    <span>Press keys...</span>
                ) : (
                    <span className='flex items-center gap-2'>
                        <Keyboard className='w-3 h-3 text-muted-foreground' />
                        {formatted}
                    </span>
                )}
            </Button>

            {!isDefault && (
                <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={onReset}
                    title='Reset to default'
                >
                    <RotateCcw className='w-3 h-3' />
                </Button>
            )}
        </div>
    )
}

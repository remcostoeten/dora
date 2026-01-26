import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

type TProps = {
    value?: string | number
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    min?: number
    max?: number
    step?: number
    className?: string
    placeholder?: string
    disabled?: boolean
    title?: string
}

export function NumberInput({
    value,
    onChange,
    min,
    max,
    step = 1,
    className,
    placeholder,
    disabled,
    title,
}: TProps) {
    const inputRef = React.useRef<HTMLInputElement>(null)

    function handleIncrement() {
        if (inputRef.current) {
            inputRef.current.stepUp(step)
            triggerChange()
        }
    }

    function handleDecrement() {
        if (inputRef.current) {
            inputRef.current.stepDown(step)
            triggerChange()
        }
    }

    function triggerChange() {
        if (!inputRef.current) return

        const input = inputRef.current
        // Dispatch input event for native listeners
        const nativeEvent = new Event('input', { bubbles: true })
        input.dispatchEvent(nativeEvent)

        // Dispatch change event for React
        if (onChange) {
            const event = {
                ...nativeEvent,
                target: input,
                currentTarget: input,
                bubbles: true,
                cancelable: false,
                type: 'change',
            } as unknown as React.ChangeEvent<HTMLInputElement>
            onChange(event)
        }
    }

    return (
        <div className={cn('relative flex items-center', className)}>
            <input
                ref={inputRef}
                type="number"
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                placeholder={placeholder}
                disabled={disabled}
                title={title}
                className={cn(
                    'flex h-full w-full rounded-md border border-input bg-background py-1 pl-2 pr-7 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                )}
            />
            <div className="absolute right-0 top-0 flex flex-col h-full border-l border-input">
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled || (max !== undefined && Number(value) >= max)}
                    onClick={handleIncrement}
                    className="flex h-1/2 w-5 items-center justify-center border-b border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none rounded-tr-md transition-colors"
                    aria-label="Increase value"
                >
                    <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={disabled || (min !== undefined && Number(value) <= min)}
                    onClick={handleDecrement}
                    className="flex h-1/2 w-5 items-center justify-center bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none rounded-br-md transition-colors"
                    aria-label="Decrease value"
                >
                    <ChevronDown className="h-2.5 w-2.5" />
                </button>
            </div>
        </div>
    )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/helpers/cn'
import { CheckIcon, CopyIcon } from '@/shared/icons/icons'

type Props = {
    className?: string
}

const resetDelay = 1600

export function CopyButton({ className }: Props) {
    const [copied, setCopied] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => () => clearTimeout(timer.current), [])

    function copy(button: HTMLButtonElement) {
        const code = button
            .closest('[data-code-block]')
            ?.querySelector('pre code')
            ?.cloneNode(true)
        if (!(code instanceof HTMLElement)) return
        code.querySelectorAll('.nd-copy-ignore').forEach((node) =>
            node.remove()
        )
        void navigator.clipboard.writeText(code.textContent ?? '').then(() => {
            setCopied(true)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setCopied(false), resetDelay)
        })
    }

    return (
        <button
            type="button"
            aria-label={copied ? 'Copied' : 'Copy code'}
            data-copied={copied || undefined}
            onClick={(event) => copy(event.currentTarget)}
            className={cn(
                'pressable inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/45 hover:bg-foreground/6 hover:text-foreground/80 focus-visible:bg-foreground/8 focus-visible:text-foreground data-copied:text-foreground',
                className
            )}
        >
            {copied ? (
                <CheckIcon className="size-3.5" />
            ) : (
                <CopyIcon className="size-3.5" />
            )}
        </button>
    )
}

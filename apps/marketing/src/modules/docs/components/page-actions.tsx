'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon, PageIcon } from '@/shared/icons/icons'

type Props = {
    markdownUrl: string
    children?: ReactNode
}

const resetDelay = 1600
const actionClass =
    'pressable inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/10 px-2.5 text-xs text-foreground/60 hover:border-foreground/20 hover:bg-foreground/4 hover:text-foreground focus-visible:bg-foreground/8 focus-visible:text-foreground data-copied:text-foreground'

export function PageActions({ markdownUrl, children }: Props) {
    const [copied, setCopied] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => () => clearTimeout(timer.current), [])

    async function copyMarkdown() {
        const response = await fetch(markdownUrl)
        if (!response.ok) return
        await navigator.clipboard.writeText(await response.text())
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetDelay)
    }

    return (
        <div className="not-prose flex flex-wrap items-center gap-2">
            <button
                type="button"
                data-copied={copied || undefined}
                onClick={() => void copyMarkdown()}
                className={actionClass}
            >
                {copied ? (
                    <CheckIcon className="size-3.5" />
                ) : (
                    <CopyIcon className="size-3.5" />
                )}
                {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <a
                href={markdownUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={actionClass}
            >
                <PageIcon className="size-3.5" />
                View as Markdown
            </a>
            {children}
        </div>
    )
}

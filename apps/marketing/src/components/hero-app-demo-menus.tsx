'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { useEffect } from 'react'

/**
 * Shared dismissable primitives for the hero app demo: a right-click context
 * menu and a modal dialog shell. Both render inline (no portal) so they
 * inherit the demo's local dark token overrides, and both close on outside
 * click or Escape via `useDismiss`.
 */

/** Binds outside-click + Escape dismissal to an inline popover while `open`. */
export function useDismiss(
    ref: RefObject<HTMLElement | null>,
    open: boolean,
    onClose: () => void
) {
    useEffect(() => {
        if (!open) return
        const onDown = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose()
            }
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [ref, open, onClose])
}

export type TMenuEntry =
    | {
          label: string
          icon: LucideIcon
          tone?: 'default' | 'destructive'
          disabled?: boolean
          onSelect: () => void
      }
    | 'separator'

type TContextMenuProps = {
    x: number
    y: number
    entries: TMenuEntry[]
    onClose: () => void
}

export function DemoContextMenu({ x, y, entries, onClose }: TContextMenuProps) {
    return (
        <div
            role="menu"
            style={{ left: x, top: y }}
            className="absolute z-50 w-[180px] rounded-md border border-sidebar-border bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
        >
            {entries.map((entry, index) => {
                if (entry === 'separator') {
                    return (
                        <div
                            key={'separator-' + index}
                            className="mx-1 my-1 h-px bg-sidebar-border"
                        />
                    )
                }
                const tone =
                    entry.tone === 'destructive'
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-popover-foreground hover:bg-sidebar-accent'
                return (
                    <button
                        type="button"
                        role="menuitem"
                        key={entry.label}
                        disabled={entry.disabled}
                        onClick={() => {
                            entry.onSelect()
                            onClose()
                        }}
                        className={
                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ' +
                            tone
                        }
                    >
                        <entry.icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                        <span className="truncate">{entry.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

type TDialogProps = {
    title: string
    onClose: () => void
    children: ReactNode
    footer: ReactNode
}

/** Modal shell scoped to the demo window: dim overlay + centered panel. */
export function DemoDialog({ title, onClose, children, footer }: TDialogProps) {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
            <button
                type="button"
                aria-label="Close dialog"
                onClick={onClose}
                className="absolute inset-0 cursor-default bg-black/50 animate-in fade-in-0 duration-150"
            />
            <div
                role="dialog"
                aria-label={title}
                className="relative z-10 w-[320px] rounded-lg border border-sidebar-border bg-popover p-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
            >
                <div className="text-sm font-medium text-foreground">
                    {title}
                </div>
                <div className="mt-3 flex flex-col gap-2.5">{children}</div>
                <div className="mt-4 flex items-center justify-end gap-2">
                    {footer}
                </div>
            </div>
        </div>
    )
}

export function DialogButton({
    label,
    primary,
    onClick
}: {
    label: string
    primary?: boolean
    onClick: () => void
}) {
    const tone = primary
        ? 'bg-primary text-primary-foreground hover:opacity-85'
        : 'border border-input text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors ' +
                tone
            }
        >
            {label}
        </button>
    )
}

/** Dark-styled native select used by the filter bar and dialogs. */
export function DemoSelect({
    value,
    options,
    ariaLabel,
    onChange
}: {
    value: string
    options: { value: string; label: string }[]
    ariaLabel: string
    onChange: (value: string) => void
}) {
    return (
        <select
            value={value}
            aria-label={ariaLabel}
            onChange={(event) => onChange(event.target.value)}
            className="h-7 rounded-[2px] border border-input bg-background/40 px-1.5 text-[11px] text-sidebar-foreground outline-hidden transition-colors hover:border-sidebar-border focus:border-sidebar-border"
        >
            {options.map((option) => (
                <option
                    key={option.value}
                    value={option.value}
                    className="bg-popover text-popover-foreground"
                >
                    {option.label}
                </option>
            ))}
        </select>
    )
}

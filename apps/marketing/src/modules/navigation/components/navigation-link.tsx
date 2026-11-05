'use client'

import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/shared/helpers/cn'
import { useActiveScroll } from '../hooks/use-active-scroll'
import type { SidebarPageNode } from '../types/navigation'
import { ShortcutKey } from './shortcut-key'
import { SidebarBadge } from './sidebar-badge'

type Props = {
    node: SidebarPageNode
    active: boolean
    onNavigate?: () => void
    nested: boolean
    shortcut?: string
}

export function NavigationLink({
    node,
    active,
    onNavigate,
    nested,
    shortcut
}: Props) {
    const opensNewTab = node.external && node.url.startsWith('http')
    const linkRef = useActiveScroll(active)

    return (
        <Link
            ref={linkRef}
            // Safe: page tree URLs are generated from existing docs pages
            href={node.url as Route}
            target={opensNewTab ? '_blank' : undefined}
            rel={opensNewTab ? 'noreferrer noopener' : undefined}
            onClick={onNavigate}
            data-active={active || undefined}
            className={cn(
                'relative flex w-full items-center gap-2.5 py-1 text-[14px] transition-colors duration-150 ease-hover focus-visible:bg-foreground/10 focus-visible:text-foreground',
                nested ? 'pr-4 pl-12 text-[13px]' : 'px-4',
                active
                    ? 'bg-foreground/6 text-foreground'
                    : 'text-foreground/65 hover:bg-foreground/3 hover:text-foreground/90'
            )}
        >
            <SidebarIcon icon={node.icon} />
            <span className="min-w-0 grow truncate">
                {node.sidebarTitle ?? node.name}
            </span>
            {node.sidebarBadge ? (
                <SidebarBadge active={active}>{node.sidebarBadge}</SidebarBadge>
            ) : null}
            {shortcut ? (
                <ShortcutKey modifier="Shift">{shortcut}</ShortcutKey>
            ) : null}
        </Link>
    )
}

function SidebarIcon({ icon }: { icon?: ReactNode }) {
    if (icon === null || icon === undefined) return null
    return (
        <span className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-[14px]">
            {icon}
        </span>
    )
}

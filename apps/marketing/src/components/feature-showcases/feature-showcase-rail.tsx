'use client'

import {
    Braces,
    Container,
    Network,
    SquareTerminal,
    Table2,
    Terminal
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { TFeatureDemo } from '@/core/config/features'

type TRailId =
    | 'sql-console'
    | 'data-viewer'
    | 'schema'
    | 'docker'
    | 'drizzle'
    | 'prisma'

const RAIL_ITEMS: { id: TRailId; icon: LucideIcon; label: string }[] = [
    { id: 'sql-console', icon: SquareTerminal, label: 'SQL Console' },
    { id: 'data-viewer', icon: Table2, label: 'Data Viewer' },
    { id: 'schema', icon: Network, label: 'Schema' },
    { id: 'docker', icon: Container, label: 'Docker Manager' },
    { id: 'drizzle', icon: Terminal, label: 'Drizzle Runner' },
    { id: 'prisma', icon: Braces, label: 'Prisma Runner' }
]

const DEMO_ACTIVE: Record<TFeatureDemo, TRailId> = {
    'database-connection': 'data-viewer',
    'query-history': 'sql-console',
    'schema-diagram': 'schema',
    'docker-containers': 'docker',
    'ssh-tunneling': 'data-viewer',
    'ai-assistant': 'sql-console',
    'drizzle-runner': 'drizzle',
    'prisma-runner': 'prisma',
    'theming': 'data-viewer'
}

function Tip({ label }: { label: string }) {
    return (
        <span
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 translate-x-[-3px] whitespace-nowrap rounded-md border border-sidebar-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-[opacity,transform] duration-150 group-hover/tip:translate-x-0 group-hover/tip:opacity-100 group-hover/tip:delay-300"
            role="tooltip"
        >
            {label}
        </span>
    )
}

function RailButton({
    icon: Icon,
    label,
    active
}: {
    icon: LucideIcon
    label: string
    active?: boolean
}) {
    const state = active
        ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-white/8 shadow-sm'
        : 'text-sidebar-foreground/88 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'

    return (
        <div
            className={
                'group/tip relative mx-auto flex h-10 w-10 shrink-0 cursor-default items-center justify-center rounded-[7px] transition-colors ' +
                state
            }
        >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <Tip label={label} />
        </div>
    )
}

export function FeatureShowcaseRail({ demo }: { demo: TFeatureDemo }) {
    const activeId = DEMO_ACTIVE[demo]

    return (
        <aside className="flex w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-3">
            <div className="mb-4 flex justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary/10 text-[11px] font-semibold text-primary">
                    D
                </div>
            </div>
            <nav
                aria-label="App navigation"
                className="flex flex-1 flex-col gap-1.5 px-2"
            >
                {RAIL_ITEMS.map(function (item) {
                    return (
                        <RailButton
                            key={item.id}
                            icon={item.icon}
                            label={item.label}
                            active={item.id === activeId}
                        />
                    )
                })}
            </nav>
        </aside>
    )
}

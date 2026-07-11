'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { GUIDES, getGuidePath } from '@/core/config/guides'

type TNavItem = {
    label: string
    href: string
}

type TNavSection = {
    title: string
    items: TNavItem[]
}

const DOCS_NAV: TNavSection[] = [
    {
        title: 'Developer docs',
        items: [{ label: 'Dora manager executor', href: '/docs/go-cli-runner' }]
    },
    {
        title: 'PostgreSQL',
        items: GUIDES.filter((g) => g.engine === 'PostgreSQL').map((g) => ({
            label: g.provider,
            href: getGuidePath(g.slug)
        }))
    },
    {
        title: 'MySQL',
        items: GUIDES.filter((g) => g.engine === 'MySQL').map((g) => ({
            label: g.provider,
            href: getGuidePath(g.slug)
        }))
    },
    {
        title: 'libSQL',
        items: GUIDES.filter((g) => g.engine === 'libSQL').map((g) => ({
            label: g.provider,
            href: getGuidePath(g.slug)
        }))
    },
    {
        title: 'SQLite',
        items: GUIDES.filter((g) => g.engine === 'SQLite').map((g) => ({
            label: g.provider,
            href: getGuidePath(g.slug)
        }))
    },
    {
        title: 'Analytics',
        items: GUIDES.filter((g) => g.engine === 'HogQL').map((g) => ({
            label: g.provider,
            href: getGuidePath(g.slug)
        }))
    }
]

export function DocsSidebar() {
    const pathname = usePathname()

    return (
        <aside className="hidden w-72 shrink-0 border-r border-line bg-surface-base/70 lg:block">
            <div className="docs-sidebar-scroll sticky top-[4.75rem] max-h-[calc(100vh-4.75rem)] overflow-y-auto px-5 py-6">
                <Link
                    href="/docs"
                    className="mb-7 inline-flex h-8 items-center border border-line px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                >
                    All docs
                </Link>
                <nav aria-label="Documentation" className="space-y-7">
                    {DOCS_NAV.map((section) => (
                        <section key={section.title}>
                            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-600">
                                {section.title}
                            </h2>
                            <ul className="grid gap-1">
                                {section.items.map((item) => {
                                    const active = pathname === item.href
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href as Route}
                                                aria-current={
                                                    active ? 'page' : undefined
                                                }
                                                className={
                                                    active
                                                        ? 'block border-l border-brand-200 bg-brand-200/[0.06] px-3 py-2 text-[13px] text-foreground'
                                                        : 'block border-l border-transparent px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:bg-white/[0.02] hover:text-foreground'
                                                }
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))}
                </nav>
            </div>
        </aside>
    )
}

'use client'

import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/shared/helpers/cn'
import { ChevronIcon, FolderIcon } from '@/shared/icons/icons'
import { useSidebarShortcuts } from '../hooks/use-sidebar-shortcuts'
import { sectionKeys } from '../utils/navigation-sections'
import type { NavigationSection } from '../types/navigation'
import { NavigationNodes } from './navigation-nodes'
import { ShortcutKey } from './shortcut-key'

type Props = {
    sections: NavigationSection[]
    pathname: string
    mobile?: boolean
    onNavigate?: () => void
}

export function SidebarNavigation({
    sections,
    pathname,
    mobile = false,
    onNavigate
}: Props) {
    const [closed, setClosed] = useState<Set<string>>(() => new Set())
    const navigationId = useId()
    const pendingFocus = useRef<number | null>(null)
    const { held, sectionIndex, jumps, pageShortcuts } = useSidebarShortcuts({
        sections,
        pathname,
        enabled: !mobile,
        onJumpToSection: (index) => {
            setClosed((previous) => {
                if (!previous.has(sections[index].id)) return previous
                const next = new Set(previous)
                next.delete(sections[index].id)
                return next
            })
            pendingFocus.current = index
        }
    })

    useEffect(() => {
        const index = pendingFocus.current
        if (index === null) return
        pendingFocus.current = null
        document
            .getElementById(`${navigationId}-section-${index}`)
            ?.querySelector<HTMLAnchorElement>('a')
            ?.focus()
    }, [jumps, navigationId])

    const content = (
        <MotionConfig
            transition={{ duration: 0.35, type: 'spring', bounce: 0 }}
        >
            <div className="flex flex-col">
                {sections.map((section, index) => {
                    const panelId = `${navigationId}-section-${index}`
                    const open = !closed.has(section.id)
                    const sectionKey = sectionKeys[index]
                    return (
                        <div key={section.id}>
                            <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={panelId}
                                className={cn(
                                    'flex w-full items-center gap-2 border-b border-foreground/6 text-left text-sm font-medium transition-colors duration-150 ease-hover focus-visible:bg-foreground/6 focus-visible:text-foreground',
                                    mobile ? 'px-5 py-3' : 'px-4 py-2.5',
                                    open
                                        ? 'bg-foreground/3 text-foreground'
                                        : 'text-foreground/70 hover:bg-foreground/3 hover:text-foreground'
                                )}
                                onClick={() =>
                                    setClosed((previous) => {
                                        const next = new Set(previous)
                                        if (!next.delete(section.id))
                                            next.add(section.id)
                                        return next
                                    })
                                }
                            >
                                <span className="flex size-4.5 items-center justify-center [&>svg]:size-4.5">
                                    {section.icon ?? <FolderIcon />}
                                </span>
                                <span className="grow">{section.name}</span>
                                {held && sectionKey ? (
                                    <ShortcutKey
                                        modifier="Shift"
                                        active={index === sectionIndex}
                                    >
                                        {sectionKey}
                                    </ShortcutKey>
                                ) : null}
                                <ChevronIcon
                                    className={cn(
                                        'size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-snappy',
                                        open && 'rotate-180'
                                    )}
                                />
                            </button>
                            <AnimatePresence initial={false}>
                                {open ? (
                                    <motion.div
                                        id={panelId}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{
                                            opacity: 0,
                                            height: 0,
                                            transition: {
                                                type: 'spring',
                                                duration: 0.25,
                                                bounce: 0
                                            }
                                        }}
                                        className="relative overflow-hidden"
                                    >
                                        <NavigationNodes
                                            nodes={section.children}
                                            pathname={pathname}
                                            onNavigate={onNavigate}
                                            shortcuts={
                                                held && index === sectionIndex
                                                    ? pageShortcuts
                                                    : undefined
                                            }
                                        />
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>
        </MotionConfig>
    )

    if (mobile) return content
    return (
        <nav
            data-docs-sidebar-viewport
            className="sidebar-viewport flex-1 overflow-x-hidden overflow-y-auto pb-3"
        >
            {content}
        </nav>
    )
}

'use client'

import type { Root } from 'fumadocs-core/page-tree'
import { useSearchContext } from 'fumadocs-ui/contexts/search'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { useRecentPages } from '@/modules/search/hooks/use-recent-pages'
import { useMobileDialog } from '../hooks/use-mobile-dialog'
import {
    setMobileNavigationOpen,
    useMobileNavigationOpen
} from '../hooks/use-mobile-navigation'
import { getNavigationSections } from '../utils/navigation-sections'
import { SearchButton } from './search-button'
import { SidebarFooter } from './sidebar-footer'
import { SidebarNavigation } from './sidebar-navigation'

type Props = { tree: Root; repositoryUrl?: string }

export function DocsSidebar({ tree, repositoryUrl }: Props) {
    const pathname = usePathname() || '/docs'
    useRecentPages(pathname)
    const mobileOpen = useMobileNavigationOpen()
    const mobileDialogRef = useMobileDialog(mobileOpen)
    const { setOpenSearch } = useSearchContext()
    const sections = useMemo(() => getNavigationSections(tree), [tree])

    return (
        <MotionConfig reducedMotion="user">
            <aside className="fixed top-(--topbar-height) bottom-0 left-0 z-30 hidden w-(--sidebar-width) flex-col border-r border-foreground/5 bg-background lg:flex">
                <SearchButton onClick={() => setOpenSearch(true)} />
                <SidebarNavigation
                    key={pathname}
                    sections={sections}
                    pathname={pathname}
                />
                <SidebarFooter repositoryUrl={repositoryUrl} />
            </aside>

            <AnimatePresence>
                {mobileOpen ? (
                    <motion.dialog
                        ref={mobileDialogRef}
                        open
                        aria-modal="true"
                        aria-label="Documentation navigation"
                        initial={{ opacity: 0, transform: 'translateY(-8px)' }}
                        animate={{
                            opacity: 1,
                            transform: 'translateY(0px)',
                            transition: {
                                duration: 0.22,
                                ease: [0.23, 1, 0.32, 1]
                            }
                        }}
                        exit={{
                            opacity: 0,
                            transform: 'translateY(-4px)',
                            transition: {
                                duration: 0.14,
                                ease: [0.23, 1, 0.32, 1]
                            }
                        }}
                        className="fixed inset-0 z-40 m-0 h-full max-h-none w-full max-w-none border-0 bg-background/95 p-0 text-foreground backdrop-blur-sm lg:hidden"
                    >
                        <div className="flex h-full flex-col pt-(--topbar-height)">
                            <SearchButton
                                onClick={() => {
                                    setMobileNavigationOpen(false)
                                    setOpenSearch(true)
                                }}
                            />
                            <div
                                data-docs-sidebar-viewport
                                className="min-h-0 flex-1 overflow-y-auto"
                            >
                                <SidebarNavigation
                                    key={pathname}
                                    sections={sections}
                                    pathname={pathname}
                                    mobile
                                    onNavigate={() =>
                                        setMobileNavigationOpen(false)
                                    }
                                />
                            </div>
                            <SidebarFooter repositoryUrl={repositoryUrl} />
                        </div>
                    </motion.dialog>
                ) : null}
            </AnimatePresence>
        </MotionConfig>
    )
}

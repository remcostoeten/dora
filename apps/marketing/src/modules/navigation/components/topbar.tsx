import type { Route } from 'next'
import Link from 'next/link'
import { site } from '@/shared/config/docs-site'
import { Logo } from './logo'
import { MenuToggle } from './menu-toggle'

export function Topbar() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 flex h-(--topbar-height) items-center border-b border-foreground/5 bg-background">
            <Link
                // Safe: /docs is the docs index page
                href={'/docs' as Route}
                className="flex h-full items-center gap-2 px-4 font-mono text-xs tracking-wider uppercase transition-colors duration-150 ease-hover hover:bg-foreground/3 focus-visible:bg-foreground/6 lg:w-(--sidebar-width) lg:border-r lg:border-foreground/5"
            >
                <Logo />
                {site.logo?.hideName ? null : site.name}
            </Link>
            <MenuToggle />
        </header>
    )
}

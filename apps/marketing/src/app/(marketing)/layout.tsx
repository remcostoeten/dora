import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { siteConfig } from '@/core/config/site'

type TLayoutProps = {
    children: ReactNode
}

export default function MarketingLayout({ children }: TLayoutProps) {
    return (
        <div className="page-shell">
            <header className="site-nav">
                <Link className="brand" href="/">
                    <Image
                        alt="Dora logo"
                        height={32}
                        priority
                        src={siteConfig.assets.icon}
                        width={32}
                    />
                    <span>{siteConfig.name}</span>
                </Link>
                <nav aria-label="Main navigation" className="nav-links">
                    <Link href="/downloads">Downloads</Link>
                    <Link href="/changelog">Changelog</Link>
                    <Link href="/docs">Docs</Link>
                    <Link href="/privacy">Privacy</Link>
                    <Link href="/app">App</Link>
                </nav>
            </header>
            {children}
        </div>
    )
}

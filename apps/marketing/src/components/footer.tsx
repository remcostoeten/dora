import Link from 'next/link'

import { CornerTick } from '@/components/corner-tick'
import { siteConfig } from '@/core/config/site'

const FOOTER_LINKS = [
    { label: 'Docs', href: '/docs', external: false },
    {
        label: 'GitHub',
        href: siteConfig.repository,
        external: true
    },
    { label: 'Changelog', href: '/changelog', external: false },
    { label: 'Contact', href: siteConfig.author.url, external: true }
] as const

function FooterLink({ href, label, external }: (typeof FOOTER_LINKS)[number]) {
    const className =
        'border-0 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground'

    if (external) {
        return (
            <a
                className={className}
                href={href}
                rel="noreferrer"
                target="_blank"
            >
                {label}
            </a>
        )
    }

    return (
        <Link className={className} href={href}>
            {label}
        </Link>
    )
}

function renderLink(link: (typeof FOOTER_LINKS)[number]) {
    return <FooterLink key={link.label} {...link} />
}

export function Footer() {
    const year = new Date().getFullYear()

    return (
        <section className="marketing-container marketing-footer relative border border-[#3a3138]">
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
            <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
            <footer className="flex flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center sm:px-8">
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium tracking-wide text-foreground">
                        {siteConfig.name}
                    </span>
                    <span className="text-xs text-muted-foreground/80">
                        {siteConfig.footerTagline}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                        &copy; {year} {siteConfig.name}. All rights reserved.
                    </span>
                </div>

                <nav
                    aria-label="Footer navigation"
                    className="flex flex-wrap items-center gap-6"
                >
                    {FOOTER_LINKS.map(renderLink)}
                </nav>
            </footer>
        </section>
    )
}

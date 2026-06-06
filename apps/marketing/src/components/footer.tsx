import Link from 'next/link'

import { CornerTick } from '@/components/corner-tick'
import { ScrollReveal } from '@/components/scroll-reveal'
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
        <section className="marketing-container marketing-footer relative border-t border-[#3a3138]">
            <span className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent" aria-hidden />
            <span className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent" aria-hidden />
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <footer className="flex flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center sm:px-8">
                <ScrollReveal delay={0}>
                    <div className="flex flex-col gap-1.5">
                        <span className="font-pixel text-sm font-[500] tracking-[0] text-foreground">
                            {siteConfig.name}
                        </span>
                        <span className="text-xs text-muted-foreground/80">
                            {siteConfig.footerTagline}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            &copy; {year} {siteConfig.name}. All rights
                            reserved.
                        </span>
                    </div>
                </ScrollReveal>

                <ScrollReveal delay={70}>
                    <nav
                        aria-label="Footer navigation"
                        className="flex flex-wrap items-center gap-6"
                    >
                        {FOOTER_LINKS.map(renderLink)}
                    </nav>
                </ScrollReveal>
            </footer>
        </section>
    )
}

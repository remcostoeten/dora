import Link from 'next/link'

import { CornerTick } from '@/components/corner-tick'
import { ScrollReveal } from '@/components/scroll-reveal'

const FOOTER_LINKS = [
    { label: 'GitHub Profile', href: 'https://github.com/remcostoeten', external: true },
    { label: 'Repository', href: 'https://github.com/remcostoeten/dora', external: true },
    { label: 'Docs', href: '/docs', external: false },
    { label: 'Changelog', href: '/changelog', external: false },
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
            <span
                className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent"
                aria-hidden
            />
            <span
                className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent"
                aria-hidden
            />
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <footer className="flex items-center justify-between px-5 py-4">
                <div className="flex flex-col gap-1">
                    <ScrollReveal delay={0}>
                        <span className="text-xs text-muted-foreground">
                            Engineered by{' '}
                            <a
                                href="https://remcostoeten.nl"
                                target="_blank"
                                rel="noreferrer"
                                className="border-0 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground"
                            >
                                Remco Stoeten
                            </a>
                        </span>
                    </ScrollReveal>
                    <ScrollReveal delay={50}>
                        <span className="text-xs text-muted-foreground/60">
                            &copy; {year} Dora. All rights reserved.
                        </span>
                    </ScrollReveal>
                </div>

                <ScrollReveal delay={100}>
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

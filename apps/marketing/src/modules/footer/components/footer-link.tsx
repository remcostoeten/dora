import type { Route } from 'next'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { namedIcons } from '@/shared/icons/icons'
import type { FooterLink as FooterLinkData } from '../types'
import { linkKind } from '../utils/link-kind'

const linkClass =
    'inline-flex items-center gap-1.5 text-fd-foreground/50 transition-colors duration-150 ease-hover hover:text-fd-foreground focus-visible:text-fd-foreground'

type Props = { link: FooterLinkData }

function LinkContent({
    link,
    external
}: {
    link: FooterLinkData
    external: boolean
}) {
    const Icon =
        typeof link.icon === 'string' ? namedIcons[link.icon] : link.icon

    return (
        <>
            {Icon ? <Icon className="size-3.5" /> : null}
            {link.label}
            {external ? (
                <ArrowUpRightIcon aria-hidden className="size-3" />
            ) : null}
        </>
    )
}

export function FooterLink({ link }: Props) {
    const kind = linkKind(link)

    if (kind === 'external') {
        return (
            <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className={linkClass}
            >
                <LinkContent link={link} external />
            </a>
        )
    }

    if (kind === 'native') {
        return (
            <a href={link.href} className={linkClass}>
                <LinkContent link={link} external={false} />
            </a>
        )
    }

    return (
        // Safe: internal footer hrefs are routes written in docs-site.ts
        <Link href={link.href as Route} className={linkClass}>
            <LinkContent link={link} external={false} />
        </Link>
    )
}

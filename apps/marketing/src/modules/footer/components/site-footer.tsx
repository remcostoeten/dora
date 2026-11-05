import type { ReactNode } from 'react'
import { isHiddenOn } from '@/shared/helpers/is-hidden-on'
import { currentYear } from '../server/current-year'
import { formatCopyright, hasYearToken } from '../utils/format-copyright'
import type { FooterConfig } from '../types'
import { FooterLink } from './footer-link'

type Props = {
    config: FooterConfig | null
    siteName: string
    logo?: ReactNode
    url: string
    enabled?: boolean
}

/**
 * @name SiteFooter
 * @description The column footer of a docs page. Renders nothing unless
 * `config` is set and enabled, the page does not set `siteFooter: false` and
 * its URL does not match `hideOn`.
 *
 * @example
 * <SiteFooter
 *   config={site.siteFooter}
 *   siteName={site.name}
 *   logo={<Logo />}
 *   url={page.url}
 *   enabled={page.data.siteFooter}
 * />
 */
export async function SiteFooter({
    config: footer,
    siteName,
    logo,
    url,
    enabled
}: Props) {
    if (!footer || footer.enabled === false || enabled === false) return null
    if (isHiddenOn(url, footer.hideOn)) return null

    const { columns, bottom } = footer
    const brand = footer.brand === true ? {} : footer.brand
    const copyright =
        bottom?.copyright && hasYearToken(bottom.copyright)
            ? formatCopyright(bottom.copyright, await currentYear())
            : bottom?.copyright
    const hasBottom = Boolean(copyright || bottom?.links?.length)

    return (
        <footer className="col-span-full row-start-5 mt-16 [contain:inline-size] border-t border-fd-foreground/5">
            <div className="mx-auto w-full max-w-6xl px-4 py-10 text-sm">
                <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
                    {brand ? (
                        <div className="flex max-w-xs flex-col gap-3 lg:w-64 lg:shrink-0">
                            <p className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase">
                                {logo}
                                {brand.name ?? siteName}
                            </p>
                            {brand.description ? (
                                <p className="text-fd-foreground/50">
                                    {brand.description}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-8">
                        {columns.map((column) => (
                            <nav key={column.title} aria-label={column.title}>
                                <h2 className="mb-3 font-mono text-xs tracking-wider text-fd-foreground uppercase">
                                    {column.title}
                                </h2>
                                <ul className="flex flex-col gap-2">
                                    {column.links.map((link) => (
                                        <li key={`${link.label}${link.href}`}>
                                            <FooterLink link={link} />
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>
                {hasBottom ? (
                    <div className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-fd-foreground/5 pt-6">
                        {copyright ? (
                            <p className="text-fd-foreground/50">{copyright}</p>
                        ) : (
                            <span />
                        )}
                        {bottom?.links?.length ? (
                            <ul className="flex flex-wrap gap-x-5 gap-y-2">
                                {bottom.links.map((link) => (
                                    <li key={`${link.label}${link.href}`}>
                                        <FooterLink link={link} />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </footer>
    )
}

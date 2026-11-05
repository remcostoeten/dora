import type { FooterConfig, FooterLink } from '../types'
import { linkKind } from './link-kind'

const scheme = /^[a-z][a-z0-9+.-]*:/i

function checkLink(link: FooterLink, where: string, errors: string[]) {
    if (link.label.trim() === '')
        errors.push(`${where}: a link has an empty label`)
    if (link.href.trim() === '') {
        errors.push(`${where}: "${link.label}" has an empty href`)
        return
    }
    if (
        linkKind(link) === 'internal' &&
        !link.href.startsWith('/') &&
        !link.href.startsWith('#')
    ) {
        if (!scheme.test(link.href)) {
            errors.push(
                `${where}: "${link.label}" href "${link.href}" must start with "/" or "#"`
            )
        }
    }
}

/**
 * @name validateFooter
 * @description Lists the problems in a footer config: no columns, a duplicate
 * or empty column title, a column without links, and links with an empty label,
 * an empty href or a relative path.
 *
 * @example
 * validateFooter({ columns: [] }) // ["siteFooter: columns is empty"]
 */
export function validateFooter(footer: FooterConfig) {
    const errors: string[] = []
    if (footer.columns.length === 0) errors.push('siteFooter: columns is empty')

    const titles = new Set<string>()
    for (const column of footer.columns) {
        const where = `siteFooter column "${column.title}"`
        if (column.title.trim() === '')
            errors.push('siteFooter: a column has an empty title')
        if (titles.has(column.title))
            errors.push(`${where}: the title is used twice`)
        titles.add(column.title)
        if (column.links.length === 0) errors.push(`${where}: has no links`)
        for (const link of column.links) checkLink(link, where, errors)
    }

    for (const link of footer.bottom?.links ?? [])
        checkLink(link, 'siteFooter bottom', errors)
    return errors
}

/**
 * @name footerInternalLinks
 * @description Every site link in the footer, for checking that the pages exist.
 *
 * @example
 * footerInternalLinks(site.siteFooter) // ["/docs", "/docs/guides/theming"]
 */
export function footerInternalLinks(footer: FooterConfig) {
    const links = [
        ...footer.columns.flatMap((column) => column.links),
        ...(footer.bottom?.links ?? [])
    ]
    return links
        .filter((link) => linkKind(link) === 'internal')
        .map((link) => link.href)
}

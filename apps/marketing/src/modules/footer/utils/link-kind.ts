import type { FooterLink } from '../types'

export type LinkKind = 'internal' | 'external' | 'native'

const webUrl = /^https?:\/\//i
const nativeUrl = /^(mailto|tel):/i

/**
 * @name linkKind
 * @description How a footer link is rendered. `external` opens in a new tab,
 * `native` is a plain anchor for `mailto:` and `tel:`, `internal` is a client
 * side link. `http(s)` URLs are external unless `external` is `false`, and any
 * other link is external when `external` is `true`.
 *
 * @example
 * linkKind({ label: "Mail", href: "mailto:me@example.com" }) // "native"
 */
export function linkKind(link: FooterLink): LinkKind {
    if (nativeUrl.test(link.href)) return 'native'
    if (link.external ?? webUrl.test(link.href)) return 'external'
    return 'internal'
}

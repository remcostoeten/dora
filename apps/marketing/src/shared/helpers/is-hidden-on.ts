function patternToRegExp(pattern: string) {
    const source = pattern
        .replace(/\/+$/, '')
        .split('/')
        .map((segment) => {
            if (segment === '**') return '.*'
            return segment
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '[^/]*')
        })
        .join('/')
    return new RegExp(`^${source}/?$`)
}

/**
 * @name isHiddenOn
 * @description Whether a page URL matches one of the `hideOn` patterns. `*`
 * matches within one path segment and `**` matches any number of segments.
 *
 * @example
 * isHiddenOn("/docs/changelog", ["/docs/changelog", "/docs/guides/**"]) // true
 */
export function isHiddenOn(url: string, patterns: string[] | undefined) {
    return (
        patterns?.some((pattern) => patternToRegExp(pattern).test(url)) ?? false
    )
}

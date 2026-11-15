const yearToken = /\{year\}/g

/**
 * @name hasYearToken
 * @description Whether a copyright line contains the `{year}` token.
 *
 * @example
 * hasYearToken("© {year} Acme") // true
 */
export function hasYearToken(text: string) {
    return text.includes('{year}')
}

/**
 * @name formatCopyright
 * @description Replaces every `{year}` token in a copyright line.
 *
 * @example
 * formatCopyright("© {year} Acme", 2026) // "© 2026 Acme"
 */
export function formatCopyright(text: string, year: number) {
    return text.replace(yearToken, String(year))
}

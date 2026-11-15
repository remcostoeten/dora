import { cacheLife } from 'next/cache'

/**
 * @name currentYear
 * @description The current year, cached so the footer can read the clock
 * without blocking the prerender.
 *
 * @example
 * const year = await currentYear() // 2026
 */
export async function currentYear() {
    'use cache'
    cacheLife('days')
    return new Date().getFullYear()
}

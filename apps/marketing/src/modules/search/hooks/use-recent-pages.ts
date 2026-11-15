'use client'

import { useEffect } from 'react'
import * as z from 'zod'
import { noop } from '@/shared/lib/noop'

const recentPagesSchema = z
    .array(z.object({ url: z.string(), title: z.string() }))
    .catch([])

export type RecentPage = z.infer<typeof recentPagesSchema>[number]

const storageKey = 'docs:recent-pages'
const maxRecent = 5

/**
 * @name readRecentPages
 * @description The pages this visitor opened most recently, newest first.
 * Empty when storage is unavailable.
 *
 * @example
 * const recent = readRecentPages()
 */
export function readRecentPages(): RecentPage[] {
    try {
        return recentPagesSchema.parse(
            JSON.parse(localStorage.getItem(storageKey) ?? '[]')
        )
    } catch {
        return []
    }
}

function rememberPage(page: RecentPage) {
    const next = [
        page,
        ...readRecentPages().filter((item) => item.url !== page.url)
    ].slice(0, maxRecent)
    try {
        localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
        noop()
    }
}

/**
 * @name useRecentPages
 * @description Records every docs page the visitor opens so search can offer
 * them before a query is typed.
 *
 * @example
 * useRecentPages(pathname)
 */
export function useRecentPages(pathname: string) {
    useEffect(() => {
        const title = document.title.split(' | ')[0]
        if (title) rememberPage({ url: pathname, title })
    }, [pathname])
}

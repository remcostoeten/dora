import type { TRouteConfig } from '@/core/config/routes'
import { source } from '@/modules/docs/server/source'

export function getDocsRouteEntries(): TRouteConfig[] {
    return source
        .getPages()
        .filter((page) => page.url !== '/docs')
        .map((page) => ({
            path: page.url,
            title: page.data.title ?? 'Dora docs',
            description: page.data.description ?? 'Documentation for Dora.',
            sitemap: true,
            index: true,
            priority: page.url.startsWith('/docs/connect') ? 0.7 : 0.55,
            changeFrequency: 'monthly'
        }))
}

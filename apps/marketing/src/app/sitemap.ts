import type { MetadataRoute } from 'next'

import { routeConfig } from '@/core/config/routes'
import { absoluteUrl } from '@/core/config/seo'

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date()
    const items: MetadataRoute.Sitemap = []

    for (const route of routeConfig) {
        if (!route.sitemap) {
            continue
        }

        items.push({
            url: absoluteUrl(route.path),
            lastModified: now,
            changeFrequency: route.changeFrequency,
            priority: route.priority
        })
    }

    return items
}

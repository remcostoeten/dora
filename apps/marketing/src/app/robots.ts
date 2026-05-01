import type { MetadataRoute } from 'next'

import { routeConfig } from '@/core/config/routes'
import { absoluteUrl } from '@/core/config/seo'

export default function robots(): MetadataRoute.Robots {
    const allow: string[] = []
    const disallow: string[] = []

    for (const route of routeConfig) {
        if (route.index) {
            allow.push(route.path)
            continue
        }

        disallow.push(route.path)
    }

    return {
        rules: [
            {
                userAgent: '*',
                allow,
                disallow
            }
        ],
        sitemap: absoluteUrl('/sitemap.xml')
    }
}

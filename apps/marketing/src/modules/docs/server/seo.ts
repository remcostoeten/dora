import 'server-only'

import { absoluteUrl } from '@/core/config/seo'
import { siteConfig } from '@/core/config/site'
import { site } from '@/shared/config/docs-site'
import { source } from './source'

type DocsPage = NonNullable<ReturnType<typeof source.getPage>>

/**
 * @name pageJsonLd
 * @description Schema.org TechArticle data for a docs page, safe to inline in
 * a script tag.
 *
 * @example
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageJsonLd(page) }} />
 */
export function pageJsonLd(page: DocsPage) {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: page.data.title,
        description: page.data.description ?? site.description,
        url: absoluteUrl(page.url),
        image: absoluteUrl(siteConfig.assets.ogImage),
        author: {
            '@type': 'Person',
            name: site.author.name,
            url: site.author.url
        },
        publisher: {
            '@type': 'Organization',
            name: siteConfig.name,
            url: siteConfig.url
        }
    }
    return JSON.stringify(data).replace(/</g, '\\u003c')
}

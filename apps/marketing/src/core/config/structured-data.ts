import { absoluteUrl } from './seo'
import { siteConfig } from './site'

export const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.assets.icon),
    sameAs: [
        'https://github.com/remcostoeten/dora',
        'https://github.com/remcostoeten',
        siteConfig.author.url
    ],
    founder: {
        '@type': 'Person',
        name: siteConfig.author.name,
        url: siteConfig.author.url
    }
}

export const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description
}

export function softwareSchema(version?: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: siteConfig.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'macOS, Windows, Linux',
        description: siteConfig.description,
        featureList: [
            'Browse and edit database tables',
            'Inspect schemas and relationships',
            'SQL console with query history',
            'Connect Postgres, MySQL, SQLite, and libSQL databases',
            'Query PostHog product analytics with HogQL',
            'ORM cockpit for Drizzle and Prisma'
        ],
        url: siteConfig.url,
        downloadUrl: absoluteUrl('/downloads'),
        screenshot: absoluteUrl(siteConfig.assets.ogImage),
        ...(version ? { softwareVersion: version } : {}),
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
        },
        author: {
            '@type': 'Person',
            name: siteConfig.author.name,
            url: siteConfig.author.url
        }
    }
}

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
            'Browse, filter, and inline-edit tables with a dry-run mode',
            'SQL console with autocomplete, query history, and Vim keybindings',
            'Connect PostgreSQL, MySQL, MariaDB, CockroachDB, SQLite, libSQL/Turso, Cloudflare D1, and DuckDB',
            'Query CSV, JSON, Parquet, and NDJSON files as tables',
            'Sign in to Supabase, Neon, Turso, PlanetScale, Vercel, Xata, or Cloudflare to connect',
            'Write Drizzle and Prisma queries with schema-aware autocomplete',
            'Diff a Drizzle or Prisma schema against the live database',
            'Schema-grounded AI SQL through OpenAI, Anthropic, Gemini, Groq, or Ollama',
            'Query PostHog product analytics with HogQL'
        ],
        license: 'https://www.gnu.org/licenses/gpl-3.0.html',
        isAccessibleForFree: true,
        sameAs: ['https://github.com/remcostoeten/dora'],
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

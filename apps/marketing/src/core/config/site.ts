export const siteConfig = {
    name: 'Dora',
    tagline: 'The database explorah',
    footerTagline: 'Engineered for developers. Built for production.',
    description:
        'Dora is a desktop database explorer for browsing data, inspecting schemas, and querying PostHog product analytics with HogQL, all in one keyboard-first workbench.',
    author: {
        name: 'remco stoeten',
        url: 'https://remcostoeten.com'
    },
    repository: 'https://github.com/remcostoeten',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://doradb.app',
    locale: 'en_US',
    themeColor: '#f7f2e8',
    keywords: [
        'Dora',
        'database explorer',
        'desktop database app',
        'database GUI',
        'SQL client',
        'Supabase GUI',
        'Neon database client',
        'Turso desktop client',
        'Railway database GUI',
        'Fly.io postgres client',
        'Aiven database client',
        'Render postgres GUI',
        'DigitalOcean database client',
        'PlanetScale GUI',
        'AWS RDS desktop client',
        'CockroachDB GUI',
        'TiDB Cloud client',
        'Vercel Postgres GUI',
        'Crunchy Bridge client',
        'Timescale Cloud GUI',
        'Azure Database client',
        'Google Cloud SQL GUI',
        'YugabyteDB client',
        'PostHog desktop client',
        'HogQL GUI',
        'PostHog query tool',
        'product analytics desktop app'
    ],
    assets: {
        icon: '/icons/icon.png',
        favicon: '/icons/logo.svg',
        logo: '/icons/logo.svg',
        ogImage: '/opengraph-image'
    }
} as const

export type TSiteConfig = typeof siteConfig

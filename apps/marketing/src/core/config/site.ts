export const siteConfig = {
    name: 'Dora',
    tagline: 'The database explorah',
    footerTagline: 'Engineered for developers. Built for production.',
    seoTitle:
        'Dora: free, open source database client for PostgreSQL, MySQL, SQLite and more',
    description:
        'Free, open source desktop database client for PostgreSQL, MySQL, MariaDB, CockroachDB, SQLite, libSQL/Turso, Cloudflare D1 and DuckDB on macOS, Windows and Linux. Browse and edit data, run SQL, and write Drizzle and Prisma queries against the live schema.',
    author: {
        name: 'remco_stoeten',
        url: 'https://remcostoeten.com'
    },
    repository: 'https://github.com/remcostoeten',
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://doradb.app',
    locale: 'en_US',
    themeColor: '#0f0c0c',
    keywords: [
        'Dora',
        'DoraDB',
        'database client',
        'open source database client',
        'database explorer',
        'Postgres GUI',
        'MySQL GUI',
        'SQLite GUI',
        'DuckDB GUI',
        'Cloudflare D1 client',
        'Drizzle query runner',
        'Prisma query runner',
        'TablePlus alternative',
        'DBeaver alternative',
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
        ogImage: '/opengraph-image.png'
    }
} as const

export type TSiteConfig = typeof siteConfig

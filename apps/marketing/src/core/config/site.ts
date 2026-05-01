export const siteConfig = {
    name: 'Dora',
    tagline: 'The database explorah',
    description:
        'Dora is a desktop database explorer for browsing data, inspecting schemas, and moving through database work with less friction.',
    author: {
        name: 'remco stoeten',
        url: 'https://remcostoeten.com'
    },
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dora.app',
    locale: 'en_US',
    themeColor: '#f7f2e8',
    keywords: [
        'Dora',
        'database explorer',
        'desktop database app',
        'database GUI',
        'SQL client'
    ],
    assets: {
        icon: '/icons/icon.png',
        favicon: '/favicon.ico',
        logo: '/icons/logo.svg',
        ogImage: '/opengraph-image'
    }
} as const

export type TSiteConfig = typeof siteConfig

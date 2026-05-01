export type TRouteConfig = {
    path: string
    title: string
    description: string
    sitemap: boolean
    index: boolean
    priority: number
    changeFrequency:
        | 'always'
        | 'hourly'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly'
        | 'never'
}

export const routeConfig = [
    {
        path: '/',
        title: 'Dora',
        description:
            'Dora is a desktop database explorer for browsing data, inspecting schemas, and moving through database work with less friction.',
        sitemap: true,
        index: true,
        priority: 1,
        changeFrequency: 'weekly'
    },
    {
        path: '/downloads',
        title: 'Download Dora',
        description:
            'Download Dora, the desktop database explorer for focused database work.',
        sitemap: true,
        index: true,
        priority: 0.8,
        changeFrequency: 'weekly'
    },
    {
        path: '/changelog',
        title: 'Dora changelog',
        description: 'Read Dora release notes, product updates, and fixes.',
        sitemap: true,
        index: true,
        priority: 0.6,
        changeFrequency: 'weekly'
    },
    {
        path: '/docs',
        title: 'Dora docs',
        description:
            'Read Dora documentation for setup, workflows, and support.',
        sitemap: true,
        index: true,
        priority: 0.7,
        changeFrequency: 'weekly'
    },
    {
        path: '/privacy',
        title: 'Dora privacy',
        description: 'Read how Dora handles privacy and product data.',
        sitemap: true,
        index: true,
        priority: 0.4,
        changeFrequency: 'yearly'
    },
    {
        path: '/app',
        title: 'Dora app preview',
        description: 'Preview the Dora application experience.',
        sitemap: false,
        index: false,
        priority: 0,
        changeFrequency: 'never'
    }
] satisfies TRouteConfig[]

export function getRoute(path: string) {
    for (const route of routeConfig) {
        if (route.path === path) {
            return route
        }
    }

    throw new Error(`Missing route config for ${path}`)
}

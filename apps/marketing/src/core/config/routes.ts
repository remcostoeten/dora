import { getFeatureRouteEntries } from '@/core/config/features'
import { getDocsRouteEntries } from '@/core/config/docs'
import { getGuideRouteEntries } from '@/core/config/guides'

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
            'Dora is a desktop database explorer for browsing data, inspecting schemas, and querying PostHog product analytics with HogQL, all in one keyboard-first workbench.',
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
            'Connection guides and setup docs for Dora: connect Supabase, Neon, Turso, PostHog, and any Postgres or libSQL database to the desktop app.',
        sitemap: true,
        index: true,
        priority: 0.7,
        changeFrequency: 'weekly'
    },
    ...getDocsRouteEntries(),
    {
        path: '/docs/go-cli-runner',
        title: 'Dora manager executor',
        description:
            'Developer docs for the Dora manager executor: TUI usage, VM workflows, and CI dispatch commands.',
        sitemap: true,
        index: true,
        priority: 0.55,
        changeFrequency: 'monthly'
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
    },
    ...getFeatureRouteEntries(),
    ...getGuideRouteEntries()
] satisfies TRouteConfig[]

export function getRoute(path: string) {
    for (const route of routeConfig) {
        if (route.path === path) {
            return route
        }
    }

    throw new Error(`Missing route config for ${path}`)
}

import type { FooterConfig } from '@/modules/footer/types'
import { siteConfig } from '@/core/config/site'

export type LogoSource = string

export type LogoConfig = {
    src: LogoSource
    alt?: string
    width: number
    height: number
    hideName?: boolean
}

export type DocsSiteConfig = {
    name: string
    description: string
    url: string
    repository: string
    branch: string
    contentDir: string
    author: { name: string; url: string }
    logo: LogoConfig | null
    pageFooter: {
        editLink: boolean
        lastUpdated: boolean
        prevNext: boolean
    }
    siteFooter: FooterConfig | null
}

export const site: DocsSiteConfig = {
    name: 'Dora docs',
    description:
        'Documentation for Dora: connect a database, browse and edit data, write SQL or ORM queries, and visualize your schema.',
    url: siteConfig.url,
    repository: 'https://github.com/remcostoeten/dora',
    branch: 'master',
    contentDir: 'docs',
    author: siteConfig.author,
    logo: { src: siteConfig.assets.logo, alt: 'Dora', width: 18, height: 18 },
    pageFooter: { editLink: true, lastUpdated: true, prevNext: true },
    siteFooter: {
        brand: { description: siteConfig.footerTagline },
        columns: [
            {
                title: 'Docs',
                links: [
                    { label: 'Introduction', href: '/docs' },
                    { label: 'Getting started', href: '/docs/getting-started' },
                    { label: 'Installation', href: '/docs/installation' }
                ]
            },
            {
                title: 'Dora',
                links: [
                    { label: 'Home', href: '/' },
                    { label: 'Features', href: '/features' },
                    { label: 'Downloads', href: '/downloads' },
                    { label: 'Changelog', href: '/changelog' }
                ]
            },
            {
                title: 'Community',
                links: [
                    {
                        label: 'GitHub',
                        href: 'https://github.com/remcostoeten/dora',
                        icon: 'GitHub'
                    }
                ]
            }
        ],
        bottom: {
            copyright: `© {year} ${siteConfig.author.name}`,
            links: [{ label: 'Privacy', href: '/privacy' }]
        }
    }
}

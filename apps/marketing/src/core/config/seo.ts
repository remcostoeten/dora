import type { Metadata } from 'next'

import { siteConfig } from './site'

type TSeoInput = {
    path: string
    title: string
    description: string
    index?: boolean
    image?: string
}

export function absoluteUrl(path = '/') {
    const baseUrl = siteConfig.url.replace(/\/$/, '')
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    return `${baseUrl}${cleanPath}`
}

export function createMetadata({
    path,
    title,
    description,
    index = true,
    image = siteConfig.assets.ogImage
}: TSeoInput): Metadata {
    const fullTitle =
        title === siteConfig.name ? title : `${title} | ${siteConfig.name}`
    const canonical = absoluteUrl(path)

    return {
        title: fullTitle,
        description,
        keywords: [...siteConfig.keywords],
        authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
        creator: siteConfig.author.name,
        publisher: siteConfig.name,
        alternates: {
            canonical
        },
        robots: {
            index,
            follow: true,
            googleBot: {
                index,
                follow: true,
                'max-image-preview': 'large',
                'max-snippet': -1,
                'max-video-preview': -1
            }
        },
        openGraph: {
            type: 'website',
            locale: siteConfig.locale,
            url: canonical,
            siteName: siteConfig.name,
            title: fullTitle,
            description,
            images: [
                {
                    url: image,
                    width: 1200,
                    height: 630,
                    alt: `${siteConfig.name} brand preview`
                }
            ]
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [image]
        }
    }
}

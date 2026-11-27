import type { Metadata, Viewport } from 'next'

import { siteConfig } from '@/core/config/site'

export const rootMetadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    title: {
        default: siteConfig.seoTitle,
        template: `%s | ${siteConfig.name}`
    },
    description: siteConfig.description,
    icons: {
        icon: [
            { url: '/icons/logo.svg', type: 'image/svg+xml' },
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icons/icon.png', type: 'image/png' }
        ],
        apple: [{ url: '/apple-icon.png' }]
    }
}

export const rootViewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: siteConfig.themeColor
}

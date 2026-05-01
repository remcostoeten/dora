import type { MetadataRoute } from 'next'

import { siteConfig } from '@/core/config/site'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: siteConfig.name,
        short_name: siteConfig.name,
        description: siteConfig.description,
        start_url: '/',
        display: 'standalone',
        background_color: siteConfig.themeColor,
        theme_color: siteConfig.themeColor,
        icons: [
            {
                src: '/icons/icon.png',
                sizes: '512x512',
                type: 'image/png'
            },
            {
                src: '/icons/128x128.png',
                sizes: '128x128',
                type: 'image/png'
            }
        ]
    }
}

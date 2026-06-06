import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Analytics } from '@remcostoeten/analytics'

import { siteConfig } from '@/core/config/site'
import '@/core/three-suppress'

import './globals.css'

const PixelFont = localFont({
    src: './fonts/GeistPixel-Square.woff2',
    variable: '--font-geist-pixel-square',
    weight: '500',
    fallback: [
        'Geist Mono',
        'ui-monospace',
        'SFMono-Regular',
        'Roboto Mono',
        'Menlo',
        'Monaco',
        'Liberation Mono',
        'DejaVu Sans Mono',
        'Courier New',
        'monospace'
    ],
    adjustFontFallback: false
})

export const metadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    title: {
        default: siteConfig.name,
        template: `%s | ${siteConfig.name}`
    },
    description: siteConfig.description,
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icons/icon.png', type: 'image/png' }
        ],
        apple: [{ url: '/apple-icon.png' }]
    }
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: siteConfig.themeColor
}

type TRootProps = {
    children: ReactNode
}

export default function RootLayout({ children }: TRootProps) {
    return (
        <html
            className={`${GeistSans.variable} ${GeistMono.variable} ${PixelFont.variable} dark`}
            lang="en"
            suppressHydrationWarning
        >
            <body>
                <main className="min-h-screen bg-background text-foreground">
                    {children}
                </main>
                <Analytics
                    projectId={process.env.NEXT_PUBLIC_ANALYTICS_PROJECT_ID}
                    ingestUrl={process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL}
                    disabled={process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'false'}
                    // trackOutbound and trackErrors available after publishing v1.5.0
                />
            </body>
        </html>
    )
}

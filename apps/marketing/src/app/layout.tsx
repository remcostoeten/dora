import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { SpoarAnalytics } from '@/core/analytics/spoar-analytics'
import { siteConfig } from '@/core/config/site'
import {
    organizationSchema,
    websiteSchema,
    softwareSchema
} from '@/core/config/structured-data'
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

/* The /app demo replicas render in the desktop app's typefaces (Inter +
   JetBrains Mono) so they match the real studio instead of the marketing
   site's Geist. */
const InterFont = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-inter'
})

const JetBrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-jetbrains-mono'
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
            { url: '/icons/logo.svg', type: 'image/svg+xml' },
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

type Props = {
    children: ReactNode
}

export default function RootLayout({ children }: Props) {
    return (
        <html
            className={`${GeistSans.variable} ${GeistMono.variable} ${PixelFont.variable} ${InterFont.variable} ${JetBrainsMono.variable} dark`}
            lang="en"
            suppressHydrationWarning
        >
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(organizationSchema)
                    }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(websiteSchema)
                    }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(softwareSchema())
                    }}
                />
            </head>
            <body>
                <main className="min-h-screen bg-background text-foreground">
                    {children}
                </main>
                <SpoarAnalytics />
            </body>
        </html>
    )
}

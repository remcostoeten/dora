import { Inter, JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { StructuredData } from '@/components/structured-data'
import { SpoarAnalytics } from '@/core/analytics/spoar-analytics'
import '@/core/three-suppress'

import '../app/globals.css'

const PixelFont = localFont({
    src: '../app/fonts/GeistPixel-Square.woff2',
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

/* The hero demo renders in the desktop app's typefaces (Inter + JetBrains
   Mono) so it matches the real studio instead of the marketing site's Geist. */
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

type Props = {
    children: ReactNode
}

export function SiteDocument({ children }: Props) {
    return (
        <html
            className={`${GeistSans.variable} ${GeistMono.variable} ${PixelFont.variable} ${InterFont.variable} ${JetBrainsMono.variable} dark`}
            lang="en"
            suppressHydrationWarning
        >
            <head>
                <StructuredData />
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

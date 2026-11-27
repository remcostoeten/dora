import type { ReactNode } from 'react'

import { StructuredData } from '@/components/structured-data'
import { SpoarAnalytics } from '@/core/analytics/spoar-analytics'

import '@dora/studio/fonts'
import '@dora/studio/styles'
import '@dora/studio/notifier-styles'
import './studio-host.css'

export {
    rootMetadata as metadata,
    rootViewport as viewport
} from '@/core/config/root-metadata'

type Props = {
    children: ReactNode
}

/* Separate root layout: the marketing stylesheet overrides studio tokens, fonts and utilities. */
export default function StudioRootLayout({ children }: Props) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <StructuredData />
            </head>
            <body>
                <div id="root">{children}</div>
                <SpoarAnalytics />
            </body>
        </html>
    )
}

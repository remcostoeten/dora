import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { MotionProvider } from '@/shared/components/motion-provider'
import { HomeView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/'))

// Statically rendered with ISR — the page is served from cache and refreshed
// in the background at most every 5 min (the shortest GitHub-stats fetch window).
export const revalidate = 300

export default function Page() {
    return (
        <MotionProvider>
            <HomeView />
        </MotionProvider>
    )
}

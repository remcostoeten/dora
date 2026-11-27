import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { MotionProvider } from '@/shared/components/motion-provider'
import { HomeView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/'))

export default function Page() {
    return (
        <MotionProvider>
            <HomeView />
        </MotionProvider>
    )
}

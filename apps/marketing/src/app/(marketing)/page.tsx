import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { HomeView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/'))

export default function Page() {
    return <HomeView />
}

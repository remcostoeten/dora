import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { AppView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/app'))

export default function Page() {
    return <AppView />
}

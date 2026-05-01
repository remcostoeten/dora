import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { DownloadsView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/downloads'))

export default function Page() {
    return <DownloadsView />
}

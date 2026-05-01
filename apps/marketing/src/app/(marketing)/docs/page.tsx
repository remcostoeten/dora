import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { DocsView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/docs'))

export default function Page() {
    return <DocsView />
}

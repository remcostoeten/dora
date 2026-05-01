import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { PrivacyView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/privacy'))

export default function Page() {
    return <PrivacyView />
}

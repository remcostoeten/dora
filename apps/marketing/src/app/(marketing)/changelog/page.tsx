import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'
import { ChangelogView } from '@/views'

export const metadata: Metadata = createMetadata(getRoute('/changelog'))

export default function Page() {
    return <ChangelogView />
}

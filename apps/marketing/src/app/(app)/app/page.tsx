import type { Metadata } from 'next'

import { getRoute } from '@/core/config/routes'
import { createMetadata } from '@/core/config/seo'

import AppMount from './app-mount'
import '@dora/studio/fonts'
import '@dora/studio/styles'

export const metadata: Metadata = createMetadata(getRoute('/app'))

export default function Page() {
    return <AppMount />
}

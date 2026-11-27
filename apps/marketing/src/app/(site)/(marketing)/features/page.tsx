import type { Metadata } from 'next'

import { FEATURES_INDEX } from '@/core/config/features'
import { createMetadata } from '@/core/config/seo'
import FeaturesIndexView from '@/views/features-index-view'

export const metadata: Metadata = createMetadata({
    path: FEATURES_INDEX.path,
    title: FEATURES_INDEX.title,
    description: FEATURES_INDEX.description,
    keywords: [
        'database explorer features',
        'sql workbench features',
        'schema visualization',
        'query history',
        'docker database workflow'
    ]
})

export default function Page() {
    return <FeaturesIndexView />
}

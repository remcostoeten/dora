import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ResourceFallback } from '@/components/resource-route-fallback'
import { GUIDES, getGuide, getGuidePath } from '@/core/config/guides'
import { createMetadata } from '@/core/config/seo'
import GuideDetailView from '@/views/guide-detail-view'

type Props = {
    params: Promise<{ provider: string }>
}

export const instant = true

export function generateStaticParams() {
    return GUIDES.map(function (guide) {
        return { provider: guide.slug }
    })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    'use cache'

    const { provider } = await params
    const guide = getGuide(provider)

    if (!guide) {
        return {}
    }

    return createMetadata({
        path: getGuidePath(guide.slug),
        title: guide.title,
        description: guide.description,
        keywords: guide.keywords
    })
}

async function GuideContent({ params }: Props) {
    const { provider } = await params
    const guide = getGuide(provider)

    if (!guide) {
        notFound()
    }

    return <GuideDetailView guide={guide} />
}

export default function Page({ params }: Props) {
    return (
        <Suspense
            fallback={
                <ResourceFallback
                    eyebrow="Connection guide"
                    title="Loading guide…"
                    lead="Preparing the provider-specific connection steps."
                    testId="connection-guide-shell"
                />
            }
        >
            <GuideContent params={params} />
        </Suspense>
    )
}

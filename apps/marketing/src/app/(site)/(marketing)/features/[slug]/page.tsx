import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { ResourceFallback } from '@/components/resource-route-fallback'
import { FEATURES, getFeature, getFeaturePath } from '@/core/config/features'
import { createMetadata } from '@/core/config/seo'
import FeatureDetailView from '@/views/feature-detail-view'

type Props = {
    params: Promise<{ slug: string }>
}

export const instant = true

export function generateStaticParams() {
    return FEATURES.map(function (feature) {
        return { slug: feature.slug }
    })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    'use cache'

    const { slug } = await params
    const feature = getFeature(slug)

    if (!feature) {
        return {}
    }

    return createMetadata({
        path: getFeaturePath(feature.slug),
        title: feature.title,
        description: feature.description,
        keywords: feature.keywords
    })
}

async function FeatureContent({ params }: Props) {
    const { slug } = await params
    const feature = getFeature(slug)

    if (!feature) {
        notFound()
    }

    return <FeatureDetailView feature={feature} />
}

export default function Page({ params }: Props) {
    return (
        <Suspense
            fallback={
                <ResourceFallback
                    eyebrow="Features"
                    title="Loading feature…"
                    lead="Preparing the feature details and interactive preview."
                    testId="feature-detail-shell"
                />
            }
        >
            <FeatureContent params={params} />
        </Suspense>
    )
}

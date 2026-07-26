import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GUIDES, getGuide, getGuidePath } from '@/core/config/guides'
import { createMetadata } from '@/core/config/seo'
import GuideDetailView from '@/views/guide-detail-view'

type Props = {
    params: Promise<{ provider: string }>
}

export function generateStaticParams() {
    return GUIDES.map(function (guide) {
        return { provider: guide.slug }
    })
}

export async function generateMetadata({
    params
}: Props): Promise<Metadata> {
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

export default async function Page({ params }: Props) {
    const { provider } = await params
    const guide = getGuide(provider)

    if (!guide) {
        notFound()
    }

    return <GuideDetailView guide={guide} />
}

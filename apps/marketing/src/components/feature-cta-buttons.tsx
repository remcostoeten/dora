'use client'

import Link from 'next/link'
import posthog from 'posthog-js'
import { useEffect } from 'react'

export function FeatureCtaButtons({
    featureSlug,
    homepageAnchor
}: {
    featureSlug: string
    homepageAnchor: string
}) {
    useEffect(() => {
        posthog.capture('feature_page_viewed', { feature: featureSlug })
    }, [featureSlug])

    return (
        <div className="mt-10 flex flex-wrap gap-3">
            <Link
                className="inline-flex min-h-10 items-center border border-brand-200/50 px-4 text-[13px] text-brand-200 transition-colors hover:bg-brand-200/6"
                href="/downloads"
                onClick={() =>
                    posthog.capture('feature_download_cta_clicked', {
                        feature: featureSlug
                    })
                }
            >
                Download Dora
            </Link>
            <Link
                className="inline-flex min-h-10 items-center border border-line px-4 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                href="/app"
                onClick={() =>
                    posthog.capture('feature_web_demo_cta_clicked', {
                        feature: featureSlug
                    })
                }
            >
                Open web demo
            </Link>
            <Link
                className="inline-flex min-h-10 items-center border border-line px-4 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                href={`/#${homepageAnchor}`}
            >
                View on homepage
            </Link>
        </div>
    )
}

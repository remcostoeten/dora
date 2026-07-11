import Link from 'next/link'

import { ResourcesPageShell } from '@/components/resources-page-shell'
import { FEATURES, FEATURES_INDEX } from '@/core/config/features'
import { featureIndexSchema } from '@/core/config/feature-structured-data'

export default function FeaturesIndexView() {
    return (
        <>
            <script
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(featureIndexSchema())
                }}
                type="application/ld+json"
            />
            <ResourcesPageShell
                eyebrow="Features"
                title={FEATURES_INDEX.title}
                lead={FEATURES_INDEX.lead}
            >
                <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
                    {FEATURES.map(function (feature) {
                        const Icon = feature.icon

                        return (
                            <article
                                key={feature.slug}
                                className="border border-line bg-background/40 p-5 transition-colors hover:bg-brand-200/4"
                            >
                                <div className="mb-4 flex items-start gap-3">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-brand-600">
                                        <Icon className="h-4 w-4" aria-hidden />
                                    </span>
                                    <div>
                                        <h2 className="font-pixel text-lg font-medium text-foreground">
                                            <Link
                                                className="transition-colors hover:text-brand-200"
                                                href={`/features/${feature.slug}`}
                                            >
                                                {feature.menuLabel}
                                            </Link>
                                        </h2>
                                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                            {feature.menuDescription}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {feature.lead}
                                </p>
                                <Link
                                    className="mt-4 inline-flex text-sm text-brand-600 transition-colors hover:text-brand-200"
                                    href={`/features/${feature.slug}`}
                                >
                                    Read more →
                                </Link>
                            </article>
                        )
                    })}
                </div>
            </ResourcesPageShell>
        </>
    )
}

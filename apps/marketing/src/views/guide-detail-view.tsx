import Link from 'next/link'

import { ResourcesPageShell } from '@/components/resources-page-shell'
import { GUIDES, getGuidePath, type TGuideConfig } from '@/core/config/guides'
import {
    guideBreadcrumbSchema,
    guideHowToSchema
} from '@/core/config/guide-structured-data'

export default function GuideDetailView({ guide }: { guide: TGuideConfig }) {
    const others = GUIDES.filter((item) => item.slug !== guide.slug)
    const related = [
        ...others.filter((item) => item.engine === guide.engine),
        ...others.filter((item) => item.engine !== guide.engine)
    ]

    return (
        <>
            <script
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify([
                        guideHowToSchema(guide),
                        guideBreadcrumbSchema(guide)
                    ])
                }}
                type="application/ld+json"
            />
            <ResourcesPageShell
                eyebrow="Connection guide"
                title={guide.title}
                lead={guide.lead}
            >
                <div className="mx-auto max-w-3xl">
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
                    >
                        <ol className="flex flex-wrap items-center gap-2">
                            <li>
                                <Link
                                    className="transition-colors hover:text-foreground"
                                    href="/docs"
                                >
                                    Docs
                                </Link>
                            </li>
                            <li aria-hidden="true">/</li>
                            <li className="text-foreground">{guide.provider}</li>
                        </ol>
                    </nav>

                    <article>
                        <div className="grid gap-4 text-[15px] leading-relaxed text-muted-foreground">
                            {guide.intro.map(function (paragraph) {
                                return <p key={paragraph}>{paragraph}</p>
                            })}
                        </div>

                        <div className="mt-8 border border-line bg-background/30 p-4">
                            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                {guide.connectionLabel ??
                                    `${guide.engine} connection string`}
                            </p>
                            <code className="block overflow-x-auto whitespace-pre font-mono text-[13px] text-ink-350">
                                {guide.connectionString}
                            </code>
                        </div>

                        <section
                            aria-labelledby="guide-steps-heading"
                            className="mt-10"
                        >
                            <h2
                                id="guide-steps-heading"
                                className="mb-5 font-pixel text-xl font-medium text-foreground"
                            >
                                Steps
                            </h2>
                            <ol className="grid gap-4">
                                {guide.steps.map(function (step, index) {
                                    return (
                                        <li
                                            key={step.title}
                                            className="border border-line bg-background/30 px-4 py-4"
                                        >
                                            <p className="mb-1 flex items-baseline gap-2 text-sm font-medium text-foreground">
                                                <span className="font-mono text-brand-200">
                                                    {index + 1}.
                                                </span>
                                                {step.title}
                                            </p>
                                            <p className="pl-5 text-sm leading-relaxed text-muted-foreground">
                                                {step.body}
                                            </p>
                                        </li>
                                    )
                                })}
                            </ol>
                        </section>

                        <section
                            aria-labelledby="guide-notes-heading"
                            className="mt-10"
                        >
                            <h2
                                id="guide-notes-heading"
                                className="mb-4 font-pixel text-lg font-medium text-foreground"
                            >
                                Good to know
                            </h2>
                            <ul className="grid gap-3">
                                {guide.notes.map(function (note) {
                                    return (
                                        <li
                                            key={note}
                                            className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-brand-200/60"
                                        >
                                            {note}
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>

                        <div className="mt-10 flex flex-wrap gap-3">
                            <Link
                                className="inline-flex min-h-10 items-center border border-brand-200/50 px-4 text-[13px] text-brand-200 transition-colors hover:bg-brand-200/6"
                                href="/downloads"
                            >
                                Download Dora
                            </Link>
                            <Link
                                className="inline-flex min-h-10 items-center border border-line px-4 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                                href="/features"
                            >
                                Browse features
                            </Link>
                            <Link
                                className="inline-flex min-h-10 items-center border border-line px-4 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                                href="/docs"
                            >
                                All connection guides
                            </Link>
                        </div>
                    </article>

                    {related.length > 0 ? (
                        <section
                            aria-labelledby="related-guides-heading"
                            className="mt-14 border-t border-line pt-10"
                        >
                            <h2
                                id="related-guides-heading"
                                className="mb-5 font-pixel text-xl font-medium text-foreground"
                            >
                                More connection guides
                            </h2>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {related.map(function (item) {
                                    return (
                                        <Link
                                            key={item.slug}
                                            className="border border-line px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-line-strong hover:text-foreground"
                                            href={getGuidePath(item.slug)}
                                        >
                                            Connect {item.provider}
                                        </Link>
                                    )
                                })}
                            </div>
                        </section>
                    ) : null}
                </div>
            </ResourcesPageShell>
        </>
    )
}

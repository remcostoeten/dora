import Link from 'next/link'

import { SectionFrame } from '@/components/section-frame'
import { QuerySwitchboard } from '@/components/features/query-switchboard'
import { getFeaturePath } from '@/core/config/features'

export function QueryWorkflowSection() {
    return (
        <section className="relative w-full">
            <SectionFrame />

            <div className="px-6 sm:px-8 py-12 border-b border-r border-line">
                <h2 className="text-2xl text-ink-600 font-light italic mb-1 font-[family-name:var(--font-pixel)]">
                    Aww, is SQL too hard for you?
                </h2>
                <h3 className="text-balance text-3xl text-ink-100 font-semibold font-[family-name:var(--font-pixel)]">
                    Three ways to ask. One engine.
                </h3>
            </div>

            <div
                id="feature-ai-assistant"
                className="relative scroll-mt-28 border-b border-r border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-brand-200/6"
            >
                <span
                    id="feature-drizzle-runner"
                    className="absolute top-0 scroll-mt-28"
                    aria-hidden
                />
                <span
                    id="feature-prisma-runner"
                    className="absolute top-0 scroll-mt-28"
                    aria-hidden
                />

                <QuerySwitchboard animate />

                <div className="relative flex flex-col gap-3 px-5 pb-8 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div className="max-w-md">
                        <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                            Every dialect lands in the same place
                        </h3>
                        <p className="text-xs text-ink-500 leading-relaxed">
                            Describe it in English, or stay type-safe in Drizzle
                            or Prisma — each path compiles to plain SQL you can
                            read, edit, and run on the same engine.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[11px]">
                        <Link
                            className="text-brand-600 transition-colors hover:text-brand-200"
                            href={getFeaturePath('ai-assistant')}
                        >
                            Ask in English →
                        </Link>
                        <Link
                            className="text-brand-600 transition-colors hover:text-brand-200"
                            href={getFeaturePath('drizzle-runner')}
                        >
                            Drizzle →
                        </Link>
                        <Link
                            className="text-brand-600 transition-colors hover:text-brand-200"
                            href={getFeaturePath('prisma-runner')}
                        >
                            Prisma →
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}

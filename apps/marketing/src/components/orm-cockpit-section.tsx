import Link from 'next/link'
import type { ReactNode } from 'react'

import { CornerTick } from '@/components/corner-tick'
import { SectionFrame } from '@/components/section-frame'
import { OrmCockpitCard } from '@/components/features/orm-cockpit-card'
import { getFeaturePath } from '@/core/config/features'

const CELL_CLASS =
    'relative min-h-[340px] scroll-mt-28 border-r border-b border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-brand-200/6'

function Token({ children }: { children: string }) {
    return (
        <code className="rounded-[3px] border border-line bg-surface-deeper px-1 py-px font-mono text-[11px] text-brand-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {children}
        </code>
    )
}

const POINTS: { head: string; body: ReactNode }[] = [
    {
        head: 'Link a project folder',
        body: (
            <>
                Point Dora at a repo. It detects <Token>Drizzle</Token> or{' '}
                <Token>Prisma</Token> and parses the schema in place — no
                codegen, no generated client, no Node runtime.
            </>
        )
    },
    {
        head: 'Diff against the live database',
        body: 'Dora introspects the connected database and compares it to your code schema, table by table, column by column.'
    },
    {
        head: 'Every change, graded',
        body: 'Each drift is tagged safe, review, or destructive — so a new nullable column reads differently from a dropped one.'
    },
    {
        head: 'Preview the migration — gated',
        body: (
            <>
                Generate dialect-correct SQL with destructive operations
                commented out until you opt in. Nothing runs from here: hand it
                to the SQL console, where the usual production guardrails apply.
            </>
        )
    }
]

export function OrmCockpitSection() {
    return (
        <section className="relative w-full">
            <SectionFrame />

            <div className="border-b border-r border-line px-6 py-12 sm:px-8">
                <h2 className="mb-1 font-[family-name:var(--font-pixel)] text-2xl font-light italic text-ink-600">
                    Your schema lives in code. Your data lives in the
                    database.
                </h2>
                <h3 className="text-balance font-[family-name:var(--font-pixel)] text-3xl font-semibold text-ink-100">
                    Diff the drift. Preview the migration.
                </h3>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2">
                <CornerTick className="hidden md:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2" />

                <div className={`${CELL_CLASS} flex`}>
                    <div className="flex h-full w-full flex-col justify-center gap-5 px-6 py-10 sm:px-8">
                        {POINTS.map((point) => (
                            <div key={point.head} className="flex gap-3">
                                <span
                                    aria-hidden
                                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: 'var(--color-brand-200)' }}
                                />
                                <div className="min-w-0">
                                    <p className="font-[family-name:var(--font-pixel)] text-[13px] font-medium text-ink-200">
                                        {point.head}
                                    </p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                                        {point.body}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div id="feature-orm-cockpit" className={`${CELL_CLASS} flex`}>
                    <OrmCockpitCard animate />
                    <Link
                        className="absolute bottom-4 right-4 z-10 text-[11px] text-brand-600 transition-colors hover:text-brand-200"
                        href={getFeaturePath('orm-cockpit')}
                    >
                        Learn more →
                    </Link>
                </div>
            </div>
        </section>
    )
}

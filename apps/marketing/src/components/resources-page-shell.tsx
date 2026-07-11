import type { ReactNode } from 'react'

import { SectionFrame } from '@/components/section-frame'

type TResourcesPageShellProps = {
    eyebrow: string
    title: string
    lead: string
    children: ReactNode
}

export function ResourcesPageShell({
    eyebrow,
    title,
    lead,
    children
}: TResourcesPageShellProps) {
    return (
        <section className="relative">
            <SectionFrame />

            <header className="border-b border-r border-line px-6 py-12 sm:px-8">
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
                    {eyebrow}
                </p>
                <h1 className="font-pixel text-balance text-[clamp(2rem,5vw,3rem)] font-medium leading-[1.05] tracking-normal text-foreground">
                    {title}
                </h1>
                <p className="mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
                    {lead}
                </p>
            </header>

            <div className="border-r border-line px-6 py-10 sm:px-8">
                {children}
            </div>
        </section>
    )
}

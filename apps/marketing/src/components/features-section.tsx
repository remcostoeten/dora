'use client'

import { useRef, useEffect, useState } from 'react'

import { CornerTick } from '@/components/corner-tick'
import { useScrollMotion } from '@/components/features/use-scroll-motion'
import { DatabaseConnectionCard } from '@/components/features/database-connection-card'
import { RegionGlobeCard } from '@/components/features/region-globe-card'
import { NativePerformanceCard } from '@/components/features/native-performance-card'
import { QueryHistoryCard } from '@/components/features/query-history-card'
import { DockerContainersCard } from '@/components/features/docker-containers-card'
import { SchemaDiagramCard } from '@/components/features/schema-diagram-card'
import { AIAssistantCard } from '@/components/features/ai-assistant-card'
import { DrizzleRunnerCard } from '@/components/features/drizzle-runner-card'
import { ScrollReveal } from '@/components/scroll-reveal'
import { usePageVisible } from '@/shared/hooks/use-page-visible'
import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'

const FEATURE_CELL_CLASS =
    'min-h-[300px] border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]'
const FEATURE_REVEAL_CLASS = 'flex h-full w-full'

export function FeaturesSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const [isInView, setIsInView] = useState(false)
    const pageVisible = usePageVisible()
    const reducedMotion = usePrefersReducedMotion()
    const animate = isInView && pageVisible && !reducedMotion
    const motion = useScrollMotion(sectionRef, { active: animate })

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const visible = entry.isIntersecting
                setIsInView(visible)
            },
            { rootMargin: '160px 0px', threshold: 0.1 }
        )
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <section
            ref={sectionRef}
            className="relative w-full border-l border-t border-[#3a3138]"
        >
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
            <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
            {/* Heading */}
            <div className="px-6 sm:px-8 py-12 border-b border-[#2b252c]">
                <ScrollReveal delay={40}>
                    <h2 className="text-2xl text-[#7a7a7a] font-light italic mb-1 font-[family-name:var(--font-pixel)]">
                        More Than a GUI.
                    </h2>
                    <h3 className="text-3xl text-[#f0f0f0] font-semibold font-[family-name:var(--font-pixel)]">
                        The Interface Databases Deserve.
                    </h3>
                </ScrollReveal>
            </div>

            {/* Feature cards — collapsed bordered grid (2-up, widening to 4-up) */}
            <div className="relative grid grid-cols-2 lg:grid-cols-4">
                {/* squares along the divider between the top and bottom rows */}
                <CornerTick className="hidden lg:block left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden lg:block left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden lg:block left-2/4 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden lg:block left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden lg:block left-full top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={0}>
                        <DatabaseConnectionCard
                            animate={animate}
                            motion={motion}
                        />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={55}>
                        <AIAssistantCard animate={animate} />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={110}>
                        <SchemaDiagramCard animate={animate} />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={165}>
                        <DockerContainersCard animate={animate} />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={220}>
                        <DrizzleRunnerCard animate={animate} />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={275}>
                        <QueryHistoryCard animate={animate} />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={330}>
                        <NativePerformanceCard
                            animate={animate}
                            motion={motion}
                        />
                    </ScrollReveal>
                </div>
                <div className={FEATURE_CELL_CLASS}>
                    <ScrollReveal className={FEATURE_REVEAL_CLASS} delay={385}>
                        <RegionGlobeCard animate={animate} motion={motion} />
                    </ScrollReveal>
                </div>
            </div>
        </section>
    )
}

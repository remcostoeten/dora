'use client'

import { useRef, type ReactNode } from 'react'

import { CornerTick } from '@/components/corner-tick'
import { SectionFrame } from '@/components/section-frame'
import { useScrollMotion } from '@/components/features/use-scroll-motion'
import { DatabaseConnectionCard } from '@/components/features/database-connection-card'
import { RegionGlobeCard } from '@/components/features/region-globe-card'
import { NativePerformanceCard } from '@/components/features/native-performance-card'
import { PasteConnectCard } from '@/components/features/paste-connect-card'
import { DockerContainersCard } from '@/components/features/docker-containers-card'
import { MultiConnectionCard } from '@/components/features/multi-connection-card'
import { PosthogAnalyticsCard } from '@/components/features/posthog-analytics-card'
import { SchemaDiagramCard } from '@/components/features/schema-diagram-card'

const FEATURE_CELL_CLASS =
    'relative min-h-[300px] scroll-mt-28 border-r border-b border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-[rgba(245,192,192,0.06)]'

function FeatureCell({ id, children }: { id: string; children: ReactNode }) {
    return (
        <div id={id} className={FEATURE_CELL_CLASS}>
            {children}
        </div>
    )
}

export function FeaturesSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const motion = useScrollMotion(sectionRef, { active: true })

    return (
        <section id="features" ref={sectionRef} className="relative w-full">
            <SectionFrame />
            <div className="border-b border-r border-line px-6 py-12 sm:px-8">
                <h2 className="mb-1 font-[family-name:var(--font-pixel)] text-2xl font-light italic text-ink-600">
                    More Than a GUI.
                </h2>
                <h3 className="font-[family-name:var(--font-pixel)] text-3xl font-semibold text-ink-100">
                    The Interface Databases Deserve.
                </h3>
            </div>

            <div className="relative grid grid-cols-2 md:grid-cols-3 md:grid-rows-2">
                <CornerTick className="hidden md:block left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-full top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <FeatureCell id="feature-multi-database">
                    <DatabaseConnectionCard animate motion={motion} />
                </FeatureCell>
                <FeatureCell id="feature-regions">
                    <RegionGlobeCard animate motion={motion} />
                </FeatureCell>
                <FeatureCell id="feature-docker">
                    <DockerContainersCard animate />
                </FeatureCell>
                <FeatureCell id="feature-schema">
                    <SchemaDiagramCard animate />
                </FeatureCell>
                <FeatureCell id="feature-performance">
                    <NativePerformanceCard animate motion={motion} />
                </FeatureCell>
                <FeatureCell id="feature-paste-connect">
                    <PasteConnectCard animate />
                </FeatureCell>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2">
                <CornerTick className="hidden md:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div
                    id="feature-multi-connection"
                    className="relative min-h-[300px] scroll-mt-28 border-b border-r border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-[rgba(245,192,192,0.06)]"
                >
                    <MultiConnectionCard animate />
                </div>
                <div
                    id="feature-posthog-analytics"
                    className="relative min-h-[300px] scroll-mt-28 border-b border-r border-line overflow-hidden transition-colors duration-[450ms] ease-out hover:bg-[rgba(245,192,192,0.06)]"
                >
                    <PosthogAnalyticsCard animate />
                </div>
            </div>
        </section>
    )
}

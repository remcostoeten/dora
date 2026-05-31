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

export function FeaturesSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const [isVisible, setIsVisible] = useState(false)
    const motion = useScrollMotion(sectionRef)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsVisible(true)
            },
            { threshold: 0.1 }
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
            <div
                className={`px-6 sm:px-8 py-12 border-b border-[#2b252c] transition-all duration-700 delay-150 ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                }`}
            >
                <h2 className="text-2xl text-[#5a5a5a] font-light italic mb-1 font-[family-name:var(--font-pixel)]">
                    More Than a GUI.
                </h2>
                <h3 className="text-3xl text-[#f0f0f0] font-semibold font-[family-name:var(--font-pixel)]">
                    The Interface Databases Deserve.
                </h3>
            </div>

            {/* Feature cards — collapsed bordered grid */}
            <div
                className={`relative grid grid-cols-2 md:grid-cols-3 md:grid-rows-2 transition-all duration-700 delay-300 ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                }`}
            >
                {/* squares along the divider between the top and bottom three */}
                <CornerTick className="hidden md:block left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-full top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <DatabaseConnectionCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <RegionGlobeCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <DockerContainersCard />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <SchemaDiagramCard />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <NativePerformanceCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <QueryHistoryCard />
                </div>
            </div>
        </section>
    )
}

'use client'

import dynamic from 'next/dynamic'

import { AnimatedFrame } from '@/components/animated-frame'
import { useInView } from '@/shared/hooks/use-in-view'
import type { GitHubStatsData } from '@/core/github/get-github-stats'

const GitHubStats = dynamic(
    () => import('@/components/github-stats').then((m) => m.GitHubStats),
    { ssr: false, loading: () => <GitHubStatsFrame /> }
)

function GitHubStatsFrame() {
    return (
        <div className="w-full bg-surface-base">
            <AnimatedFrame className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                    <div className="min-h-[150px] w-full flex-shrink-0 border-b border-surface-elevated sm:min-h-[120px] sm:w-1/3 sm:border-b-0 sm:border-r" />
                    <div className="min-h-[150px] flex-1 sm:min-h-[120px]" />
                </div>
                <div className="min-h-[112px] border-t border-surface-elevated" />
            </AnimatedFrame>
        </div>
    )
}

export function DeferredGitHubStats({ data }: { data: GitHubStatsData }) {
    const [ref, inView] = useInView<HTMLDivElement>({
        rootMargin: '320px 0px',
        threshold: 0
    })

    return (
        <div ref={ref}>
            {inView ? <GitHubStats data={data} /> : <GitHubStatsFrame />}
        </div>
    )
}

'use client'

import { AiAssistantShowcase } from '@/components/feature-showcases/ai-assistant-showcase'
import { AnalyticsShowcase } from '@/components/feature-showcases/analytics-showcase'
import { DockerContainersShowcase } from '@/components/feature-showcases/docker-containers-showcase'
import { DrizzleRunnerShowcase } from '@/components/feature-showcases/drizzle-runner-showcase'
import { FeatureShowcaseShell } from '@/components/feature-showcases/feature-showcase-shell'
import { MultiDatabaseShowcase } from '@/components/feature-showcases/multi-database-showcase'
import { OrmCockpitShowcase } from '@/components/feature-showcases/orm-cockpit-showcase'
import { PrismaRunnerShowcase } from '@/components/feature-showcases/prisma-runner-showcase'
import { QueryHistoryShowcase } from '@/components/feature-showcases/query-history-showcase'
import { SshTunnelingShowcase } from '@/components/feature-showcases/ssh-tunneling-showcase'
import { SchemaVisualizationShowcase } from '@/components/feature-showcases/schema-visualization-showcase'
import { ThemingShowcase } from '@/components/feature-showcases/theming-showcase'
import {
    FEATURE_DEMO_SLUG,
    FEATURE_SHOWCASE_LABELS
} from '@/core/config/feature-captures'
import type { TFeatureDemo } from '@/core/config/features'

function ShowcaseContent({ demo }: { demo: TFeatureDemo }) {
    switch (demo) {
        case 'database-connection':
            return <MultiDatabaseShowcase />
        case 'query-history':
            return <QueryHistoryShowcase />
        case 'schema-diagram':
            return <SchemaVisualizationShowcase />
        case 'docker-containers':
            return <DockerContainersShowcase />
        case 'ssh-tunneling':
            return <SshTunnelingShowcase />
        case 'ai-assistant':
            return <AiAssistantShowcase />
        case 'drizzle-runner':
            return <DrizzleRunnerShowcase />
        case 'prisma-runner':
            return <PrismaRunnerShowcase />
        case 'orm-cockpit':
            return <OrmCockpitShowcase />
        case 'theming':
            return <ThemingShowcase />
        case 'posthog-analytics':
            return <AnalyticsShowcase />
    }
}

export function FeatureShowcase({ demo }: { demo: TFeatureDemo }) {
    const slug = FEATURE_DEMO_SLUG[demo]

    return (
        <FeatureShowcaseShell slug={slug} label={FEATURE_SHOWCASE_LABELS[demo]}>
            <ShowcaseContent demo={demo} />
        </FeatureShowcaseShell>
    )
}

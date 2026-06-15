import type { TFeatureDemo, TFeatureSlug } from '@/core/config/features'

export const FEATURE_DEMO_SLUG: Record<TFeatureDemo, TFeatureSlug> = {
    'database-connection': 'multi-database',
    'query-history': 'query-history',
    'schema-diagram': 'schema-visualization',
    'docker-containers': 'docker-containers',
    'ssh-tunneling': 'ssh-tunneling',
    'ai-assistant': 'ai-assistant',
    'drizzle-runner': 'drizzle-runner',
    'prisma-runner': 'prisma-runner',
    'theming': 'theming'
}

export const FEATURE_SHOWCASE_LABELS: Record<TFeatureDemo, string> = {
    'database-connection':
        'Connection switcher and saved databases in Dora',
    'query-history':
        'Query history panel with replay, latency, and connection context',
    'schema-diagram':
        'Live ER diagram with foreign keys and table metadata',
    'docker-containers':
        'Docker manager with container status, ports, and database handoff',
    'ssh-tunneling':
        'SSH tunnel config connecting to a private database through a jump host',
    'ai-assistant':
        'Schema-aware AI assistant generating reviewable SQL',
    'drizzle-runner':
        'Drizzle runner with schema-aware autocomplete and SQL preview',
    'prisma-runner':
        'Prisma runner translating Prisma Client queries to SQL before they run',
    'theming':
        'Custom theming and look-and-feel settings in Dora'
}

export const FEATURE_CAPTURE_SEEK_SEC = 0

/** Feature pages that use the animated mock only — no captured WebM. */
export const FEATURE_SLUGS_WITHOUT_VIDEO: TFeatureSlug[] = [
    'ssh-tunneling',
    'prisma-runner'
]

export function featureUsesCaptureVideo(slug: TFeatureSlug) {
    return !FEATURE_SLUGS_WITHOUT_VIDEO.includes(slug)
}

export function getFeatureCapturePaths(slug: TFeatureSlug) {
    const base = `/features/${slug}`
    return {
        poster: `${base}.png`,
        video: `${base}.webm`
    }
}

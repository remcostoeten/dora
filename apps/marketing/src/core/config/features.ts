import type { LucideIcon } from 'lucide-react'
import {
    Boxes,
    Braces,
    Database,
    History,
    MessageSquare,
    Network,
    Palette,
    Terminal,
    Zap
} from 'lucide-react'

import type { TRouteConfig } from '@/core/config/routes'

export type TFeatureSlug =
    | 'multi-database'
    | 'query-history'
    | 'schema-visualization'
    | 'docker-containers'
    | 'ssh-tunneling'
    | 'ai-assistant'
    | 'drizzle-runner'
    | 'prisma-runner'
    | 'theming'

export type TFeatureDemo =
    | 'database-connection'
    | 'query-history'
    | 'schema-diagram'
    | 'docker-containers'
    | 'ssh-tunneling'
    | 'ai-assistant'
    | 'drizzle-runner'
    | 'prisma-runner'
    | 'theming'

export type TFeatureConfig = {
    slug: TFeatureSlug
    demo: TFeatureDemo
    menuLabel: string
    menuDescription: string
    icon: LucideIcon
    inNav: boolean
    homepageAnchor: string
    title: string
    description: string
    lead: string
    paragraphs: string[]
    highlights: string[]
    keywords: string[]
}

export const FEATURES_INDEX = {
    path: '/features',
    title: 'Dora features',
    description:
        'Explore Dora features for multi-database connections, schema visualization, query history, Docker workflows, SSH tunneling, and AI-assisted SQL.',
    lead: 'Browse the capabilities that ship in Dora today — from connection management to schema exploration and AI-assisted querying.'
} satisfies Pick<TRouteConfig, 'path' | 'title' | 'description'>

export const FEATURES: TFeatureConfig[] = [
    {
        slug: 'multi-database',
        demo: 'database-connection',
        menuLabel: 'Multi-Database',
        menuDescription: 'PostgreSQL, MySQL, SQLite & libSQL',
        icon: Database,
        inNav: true,
        homepageAnchor: 'feature-multi-database',
        title: 'Multi-database connections in Dora',
        description:
            'Connect PostgreSQL, MySQL, SQLite, libSQL, and more in one desktop database workbench with saved connections and fast switching.',
        lead: 'Use one keyboard-first app to open local files, hosted Postgres, Turso libSQL, and tunneled databases without juggling separate clients.',
        paragraphs: [
            'Dora keeps every connection in a searchable sidebar so you can move between production, staging, and local databases without reopening tools or retyping credentials.',
            'Connection strings are parsed on paste, and the desktop app stores credentials with OS-backed secure storage when available.',
            'Hosted providers get first-class presets — Supabase, Neon, Railway, Fly.io, and a dozen more prefill the right host, port, and SSL so you are not hand-assembling URLs. For Supabase you can skip the string entirely and connect with one-click OAuth: authorize in the browser and pick a project.'
        ],
        highlights: [
            'PostgreSQL, MySQL, SQLite, and libSQL support',
            'One-click Supabase OAuth — authorize in the browser, pick a project',
            'First-class presets for 10+ hosted Postgres & MySQL providers',
            'Saved connections with fast switching',
            'Connection string parsing on paste',
            'SSH tunnel and credential storage in the desktop app'
        ],
        keywords: [
            'multi database client',
            'postgresql gui',
            'mysql desktop client',
            'sqlite browser',
            'libsql turso client',
            'supabase gui',
            'supabase desktop client',
            'neon database client',
            'railway database viewer',
            'fly.io postgres client',
            'aiven database client',
            'render postgres gui',
            'digitalocean database gui',
            'planetscale gui',
            'aws rds desktop client',
            'cockroachdb gui',
            'tidb cloud client',
            'vercel postgres gui',
            'crunchy bridge client',
            'timescale cloud gui',
            'azure database client',
            'google cloud sql gui',
            'yugabytedb client'
        ]
    },
    {
        slug: 'query-history',
        demo: 'query-history',
        menuLabel: 'Query History',
        menuDescription: 'Search, replay and analyze every query',
        icon: History,
        inNav: true,
        homepageAnchor: 'feature-query-history',
        title: 'Query history in Dora',
        description:
            'Search, replay, and review SQL query history in Dora with latency context and fast access to recent work.',
        lead: 'Every query you run stays within reach so you can replay, compare, and continue work without digging through terminal scrollback.',
        paragraphs: [
            'Dora records the queries you execute and surfaces them in a timeline designed for developers who rerun and refine SQL throughout the day.',
            'History stays tied to the active connection so you can return to the exact statement you used minutes or hours earlier.'
        ],
        highlights: [
            'Replay recent SQL from a visual timeline',
            'Latency bars for quick performance scanning',
            'Connection-scoped history',
            'Keyboard-first workflow integration'
        ],
        keywords: [
            'sql query history',
            'sql replay',
            'database query log',
            'sql client history'
        ]
    },
    {
        slug: 'schema-visualization',
        demo: 'schema-diagram',
        menuLabel: 'Schema Visualization',
        menuDescription: 'Live ER diagrams of your relationships',
        icon: Network,
        inNav: true,
        homepageAnchor: 'feature-schema',
        title: 'Schema visualization in Dora',
        description:
            'Inspect live database schema relationships with ER-style diagrams, foreign keys, and table structure in Dora.',
        lead: 'See how tables relate before you write joins — foreign keys, column types, and relationship paths stay visible while you explore.',
        paragraphs: [
            'Dora renders schema structure as an explorable diagram so you can understand foreign keys and table layout without leaving the app.',
            'The schema view complements the data grid, making it easier to navigate from relationships to the rows that back them.'
        ],
        highlights: [
            'ER-style relationship diagram',
            'Foreign key discovery',
            'Table and column metadata',
            'Schema-driven navigation into table data'
        ],
        keywords: [
            'database schema visualization',
            'erd diagram tool',
            'foreign key explorer',
            'sql schema viewer'
        ]
    },
    {
        slug: 'docker-containers',
        demo: 'docker-containers',
        menuLabel: 'Docker Containers',
        menuDescription: 'Spin up and manage local databases',
        icon: Boxes,
        inNav: true,
        homepageAnchor: 'feature-docker',
        title: 'Docker database workflows in Dora',
        description:
            'Manage local database containers from Dora and connect to running Docker workloads without leaving your SQL workbench.',
        lead: 'Spin up the databases you need for development, inspect container state, and connect directly from the same desktop app you use to query data.',
        paragraphs: [
            'Dora includes a Docker manager surface for developers who run Postgres, MySQL, and other services locally during feature work.',
            'Container status, ports, and connection context stay visible so local environments are easier to trust before you run SQL against them.'
        ],
        highlights: [
            'Local container visibility from the desktop app',
            'Database-oriented Docker workflows',
            'Faster handoff from container to connected query session',
            'Built for local development loops'
        ],
        keywords: [
            'docker database gui',
            'local postgres docker',
            'database container manager',
            'sql docker workflow'
        ]
    },
    {
        slug: 'ssh-tunneling',
        demo: 'ssh-tunneling',
        menuLabel: 'SSH Tunneling',
        menuDescription: 'Reach private databases through secure tunnels',
        icon: Zap,
        inNav: true,
        homepageAnchor: 'feature-performance',
        title: 'SSH tunneling for private databases in Dora',
        description:
            'Connect to databases behind firewalls or in private networks through encrypted SSH tunnels configured directly in the Dora desktop app.',
        lead: 'Reach staging, production, and cloud databases that are not publicly exposed — without a VPN or a separate tunnel process running in a terminal.',
        paragraphs: [
            'Dora handles the SSH tunnel lifecycle alongside the database connection so you open one thing and get one working session, not a tunnel process you have to babysit separately.',
            'Tunnel config is stored with the connection and encrypted in the same OS-backed credential store, so credentials and jump hosts stay private across machine restarts.'
        ],
        highlights: [
            'SSH tunnel config stored per connection',
            'Jump host and key-based auth support',
            'Tunnel lifecycle managed by the desktop app',
            'Works with PostgreSQL, MySQL, and libSQL over SSH'
        ],
        keywords: [
            'ssh tunnel database',
            'database behind firewall',
            'ssh port forwarding sql',
            'secure database connection desktop'
        ]
    },
    {
        slug: 'ai-assistant',
        demo: 'ai-assistant',
        menuLabel: 'AI SQL assistant',
        menuDescription: 'Natural language to SQL with schema context',
        icon: MessageSquare,
        inNav: false,
        homepageAnchor: 'feature-ai-assistant',
        title: 'AI SQL assistant in Dora',
        description:
            'Turn plain-language questions into SQL in Dora with schema-aware context and multi-provider AI support in the desktop app.',
        lead: 'Describe the result you need, and Dora drafts SQL against your live schema context so you can review, edit, and run the statement immediately.',
        paragraphs: [
            'The assistant is built for database work, not generic chat. Prompts can use schema context so generated SQL reflects real tables, columns, and indexes.',
            'The desktop app supports multiple AI providers with encrypted key storage so you can choose the model that fits your workflow.'
        ],
        highlights: [
            'Natural-language to SQL generation',
            'Schema-aware prompts',
            'Streaming answers in the workbench',
            'Multi-provider AI support in the desktop app'
        ],
        keywords: [
            'ai sql generator',
            'natural language to sql',
            'schema aware ai',
            'database copilot'
        ]
    },
    {
        slug: 'drizzle-runner',
        demo: 'drizzle-runner',
        menuLabel: 'Drizzle runner',
        menuDescription: 'Type-safe Drizzle queries with SQL preview',
        icon: Terminal,
        inNav: false,
        homepageAnchor: 'feature-drizzle-runner',
        title: 'Drizzle runner in Dora',
        description:
            'Write and run Drizzle ORM queries in Dora with context-aware autocomplete and SQL preview before execution.',
        lead: 'Stay in type-safe Drizzle when that is how you think, then inspect the SQL Dora will execute before it hits the database.',
        paragraphs: [
            'Dora includes a Drizzle-oriented runner for teams that model queries in TypeScript-first ORM syntax instead of raw SQL alone.',
            'Autocomplete and SQL preview keep the workflow grounded in your live schema so generated statements stay reviewable.'
        ],
        highlights: [
            'Drizzle query authoring inside the workbench',
            'Schema-aware autocomplete',
            'SQL preview before execution',
            'Pairs with raw SQL console workflows'
        ],
        keywords: [
            'drizzle orm gui',
            'drizzle sql client',
            'typescript database queries',
            'drizzle query builder'
        ]
    },
    {
        slug: 'prisma-runner',
        demo: 'prisma-runner',
        menuLabel: 'Prisma runner',
        menuDescription: 'Run Prisma Client queries with live SQL preview',
        icon: Braces,
        inNav: false,
        homepageAnchor: 'feature-prisma-runner',
        title: 'Prisma runner in Dora',
        description:
            'Write Prisma Client queries in Dora and run them against your live database, with a SQL preview and no schema file or Node runtime required.',
        lead: 'Query the way you already do in your app — Prisma Client syntax — and watch Dora translate it to SQL you can read before it runs.',
        paragraphs: [
            'Dora adds a Prisma tab next to the SQL console and the Drizzle runner. Write queries like prisma.user.findMany({ where: { active: true } }) and Dora translates them to SQL on the fly, executes them through the same native engine as everything else, and shows the rows in the standard results panel.',
            'It is a translation layer, not a Prisma runtime: there is no generated client, no schema.prisma file, and no Node process to manage. Dora derives the model names from your live schema, so the runner reflects the database you are actually connected to.'
        ],
        highlights: [
            'Write Prisma Client queries against any connected database',
            'Live SQL preview before you run',
            'No schema.prisma file, codegen, or Node runtime',
            'Model names inferred from your live schema'
        ],
        keywords: [
            'prisma orm gui',
            'prisma client sql',
            'run prisma queries',
            'prisma studio alternative',
            'prisma query runner'
        ]
    },
    {
        slug: 'theming',
        demo: 'theming',
        menuLabel: 'Theming',
        menuDescription: 'Custom look and feel for your workspace',
        icon: Palette,
        inNav: true,
        homepageAnchor: 'feature-theming',
        title: 'Custom theming in Dora',
        description:
            'Personalise Dora with custom themes, accent colours, and font choices to match your workflow and reduce visual fatigue.',
        lead: 'Make the workbench yours — choose a colour scheme, tweak the accent, and pick a density that fits how you work.',
        paragraphs: [
            'Dora ships with a dark base and a set of built-in themes, and lets you override accent colours and surface tones without touching config files.',
            'Theme changes apply instantly across all panels so you can preview the result while you adjust, not after a restart.'
        ],
        highlights: [
            'Built-in dark and light theme variants',
            'Custom accent colour picker',
            'Live preview with no restart required',
            'Per-workspace theme persistence'
        ],
        keywords: [
            'database gui theme',
            'dark mode sql client',
            'custom database workbench',
            'sql client appearance'
        ]
    }
]

const featureBySlug = new Map(FEATURES.map((feature) => [feature.slug, feature]))

export function getFeature(slug: string): TFeatureConfig | undefined {
    return featureBySlug.get(slug as TFeatureSlug)
}

export function getFeaturePath(slug: TFeatureSlug): string {
    return `/features/${slug}`
}

export function getNavFeatures(): TFeatureConfig[] {
    return FEATURES.filter((feature) => feature.inNav)
}

export function getFeatureRouteEntries(): TRouteConfig[] {
    const indexRoute: TRouteConfig = {
        path: FEATURES_INDEX.path,
        title: FEATURES_INDEX.title,
        description: FEATURES_INDEX.description,
        sitemap: true,
        index: true,
        priority: 0.85,
        changeFrequency: 'monthly'
    }

    const detailRoutes = FEATURES.map(function (feature) {
        return {
            path: getFeaturePath(feature.slug),
            title: feature.title,
            description: feature.description,
            sitemap: true,
            index: true,
            priority: 0.75,
            changeFrequency: 'monthly' as const
        }
    })

    return [indexRoute, ...detailRoutes]
}

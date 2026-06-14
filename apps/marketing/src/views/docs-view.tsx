import Link from 'next/link'

import { ResourcesPageShell } from '@/components/resources-page-shell'
import { GUIDES, GUIDES_INDEX, getGuidePath } from '@/core/config/guides'

export default function DocsView() {
    return (
        <ResourcesPageShell
            eyebrow="Docs"
            title={GUIDES_INDEX.title}
            lead={GUIDES_INDEX.lead}
        >
            <div className="mx-auto max-w-3xl">
                <section className="mb-10">
                    <h2 className="mb-4 font-pixel text-xl font-medium text-foreground">
                        Developer docs
                    </h2>
                    <Link
                        href="/docs/go-cli-runner"
                        className="block border border-[#2b252c] bg-background/30 px-4 py-4 transition-colors hover:border-[#3a3138]"
                    >
                        <span className="block text-sm font-medium text-foreground">
                            Dora manager executor
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                            Go-based CLI and TUI executor for VM workflows, CI
                            dispatch, and local automation.
                        </span>
                    </Link>
                </section>

                <h2 className="mb-5 font-pixel text-xl font-medium text-foreground">
                    Connection guides
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {GUIDES.map(function (guide) {
                        return (
                            <Link
                                key={guide.slug}
                                href={getGuidePath(guide.slug)}
                                className="group flex items-center gap-3 border border-[#2b252c] bg-background/30 px-4 py-4 transition-colors hover:border-[#3a3138]"
                            >
                                <img
                                    src={guide.logo}
                                    alt={`${guide.provider} logo`}
                                    width={24}
                                    height={24}
                                    className="size-6 opacity-75"
                                    style={{ filter: 'grayscale(1) brightness(1.7)' }}
                                    draggable={false}
                                />
                                <span className="flex flex-col">
                                    <span className="text-sm font-medium text-foreground">
                                        Connect {guide.provider}
                                    </span>
                                    <span className="text-[13px] text-muted-foreground">
                                        {guide.engine}
                                    </span>
                                </span>
                            </Link>
                        )
                    })}
                </div>

                <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">
                    Dora connects to any PostgreSQL, MySQL, or libSQL host the
                    same way — Railway, Render, Vercel Postgres, Fly.io, Aiven,
                    DigitalOcean, Crunchy Bridge, Timescale, AWS RDS, Azure,
                    Google Cloud SQL, CockroachDB Cloud, TiDB Cloud, PlanetScale,
                    and self-hosted databases all work with a standard
                    connection string, recognized automatically with the right
                    engine and SSL. More setup and workflow docs are on the way.
                </p>
            </div>
        </ResourcesPageShell>
    )
}

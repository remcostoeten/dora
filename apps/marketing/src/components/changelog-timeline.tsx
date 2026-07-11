'use client'

import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'

import { ScrollReveal } from '@/components/scroll-reveal'
import type { ChangelogRelease } from '@/core/content/changelog-data'

const GROUP_TONE: Record<string, string> = {
    Features: 'bg-emerald-500/80',
    'Bug Fixes': 'bg-red-400/80',
    Performance: 'bg-sky-400/80',
    Refactoring: 'bg-violet-400/80',
    'CI/CD': 'bg-amber-400/80',
    Chores: 'bg-zinc-400/60',
    Documentation: 'bg-blue-400/70',
    Testing: 'bg-teal-400/70',
    Other: 'bg-zinc-500/50'
}

const ISSUE_PATTERN = /#(\d+)/g

// Derive the repo's issues URL from a release tag URL so links always point at
// wherever the repo currently lives (single source of truth: changelog-data).
// e.g. https://github.com/owner/repo/releases/tag/v1.2.3 -> https://github.com/owner/repo/issues
function issuesBaseUrl(tagUrl: string): string | null {
    const match = tagUrl.match(/^(https?:\/\/github\.com\/[^/]+\/[^/]+)/)
    return match ? `${match[1]}/issues` : null
}

function renderItem(item: string, issuesUrl: string | null): ReactNode {
    if (!issuesUrl) return item

    const nodes: ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    ISSUE_PATTERN.lastIndex = 0
    while ((match = ISSUE_PATTERN.exec(item)) !== null) {
        const [token, issueNumber] = match

        if (match.index > lastIndex) {
            nodes.push(item.slice(lastIndex, match.index))
        }

        nodes.push(
            <a
                key={`${match.index}-${issueNumber}`}
                href={`${issuesUrl}/${issueNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-brand-200 underline decoration-brand-200/30 underline-offset-2 transition-colors hover:decoration-brand-200"
            >
                {token}
            </a>
        )

        lastIndex = match.index + token.length
    }

    if (lastIndex < item.length) {
        nodes.push(item.slice(lastIndex))
    }

    return nodes
}

function formatDate(dateString: string): string {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })
}

function groupTone(name: string): string {
    return GROUP_TONE[name] ?? 'bg-zinc-500/50'
}

function releaseHasNotes(release: ChangelogRelease): boolean {
    return release.groups.some(function (group) {
        return group.items.length > 0
    })
}

function ChangelogReleaseCard({
    release,
    isLatest
}: {
    release: ChangelogRelease
    isLatest: boolean
}) {
    const hasNotes = releaseHasNotes(release)
    const issuesUrl = issuesBaseUrl(release.tagUrl)

    return (
        <article
            id={`v${release.version}`}
            className="scroll-mt-28 border border-line bg-background/40"
        >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-pixel text-2xl font-medium leading-none text-foreground sm:text-3xl">
                        v{release.version}
                    </h2>
                    {isLatest ? (
                        <span className="inline-flex items-center rounded-[2px] border border-brand-200/40 bg-brand-200/8 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-brand-200">
                            Latest
                        </span>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <time dateTime={release.date}>{formatDate(release.date)}</time>
                    <span className="h-3.5 w-px bg-line" aria-hidden />
                    <a
                        href={release.tagUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-brand-200"
                    >
                        View on GitHub
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    </a>
                </div>
            </header>

            {hasNotes ? (
                <div className="grid gap-6 px-5 py-5 sm:px-6">
                    {release.groups.map(function (group) {
                        if (group.items.length === 0) return null

                        return (
                            <section key={`${release.version}-${group.name}`}>
                                <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${groupTone(group.name)}`}
                                        aria-hidden
                                    />
                                    {group.name}
                                </h3>
                                <ul className="grid max-w-3xl gap-2 pl-3.5">
                                    {group.items.map(function (item) {
                                        return (
                                            <li
                                                key={item}
                                                className="relative pl-3 text-[14px] leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.62em] before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-line-strong"
                                            >
                                                {renderItem(item, issuesUrl)}
                                            </li>
                                        )
                                    })}
                                </ul>
                            </section>
                        )
                    })}
                </div>
            ) : (
                <p className="px-5 py-5 text-sm text-muted-foreground/70 sm:px-6">
                    No release notes published for this version.
                </p>
            )}
        </article>
    )
}

export function ChangelogTimeline({
    releases
}: {
    releases: ChangelogRelease[]
}) {
    const jumpVersions = releases.slice(0, 12)

    return (
        <div className="mx-auto max-w-4xl">
            <nav
                aria-label="Release versions"
                className="mb-8 flex flex-wrap gap-2 border-b border-line pb-6"
            >
                {jumpVersions.map(function (release) {
                    return (
                        <a
                            key={release.version}
                            href={`#v${release.version}`}
                            className="inline-flex items-center rounded-[2px] border border-line px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-line-strong hover:bg-brand-600/6 hover:text-foreground"
                        >
                            v{release.version}
                        </a>
                    )
                })}
            </nav>

            <div className="grid gap-5">
                {releases.map(function (release, index) {
                    return (
                        <ScrollReveal
                            key={release.version}
                            delay={Math.min(index * 25, 200)}
                        >
                            <ChangelogReleaseCard
                                release={release}
                                isLatest={index === 0}
                            />
                        </ScrollReveal>
                    )
                })}
            </div>
        </div>
    )
}

import { ResourcesPageShell } from '@/components/resources-page-shell'

type Props = {
    eyebrow: string
    title: string
    lead: string
    testId: string
}

export function ResourceFallback({ eyebrow, title, lead, testId }: Props) {
    return (
        <ResourcesPageShell eyebrow={eyebrow} title={title} lead={lead}>
            <div
                aria-busy="true"
                aria-live="polite"
                className="mx-auto grid max-w-5xl gap-4"
                data-testid={testId}
            >
                <span className="sr-only">Loading page content</span>
                <div className="h-40 animate-pulse border border-line bg-background/40" />
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="h-24 animate-pulse border border-line bg-background/30" />
                    <div className="h-24 animate-pulse border border-line bg-background/30" />
                </div>
            </div>
        </ResourcesPageShell>
    )
}

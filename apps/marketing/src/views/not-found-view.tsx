import Link from 'next/link'

import { ResourcesPageShell } from '@/components/resources-page-shell'

export default function NotFound() {
    return (
        <ResourcesPageShell
            eyebrow="404"
            title="Page not found"
            lead="This Dora page does not exist."
        >
            <Link
                className="inline-flex min-h-10 items-center border border-brand-200/50 px-5 text-[13px] text-brand-200 transition-colors hover:bg-brand-200/6"
                href="/"
            >
                Go home
            </Link>
        </ResourcesPageShell>
    )
}

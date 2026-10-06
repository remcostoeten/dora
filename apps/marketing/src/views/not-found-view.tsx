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
                className="inline-flex min-h-10 items-center border border-brand-200/50 px-5 text-[13px] text-brand-200 transition-[color,background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-brand-200/6 active:scale-[0.985] motion-reduce:active:scale-100"
                href="/"
            >
                Go home
            </Link>
        </ResourcesPageShell>
    )
}

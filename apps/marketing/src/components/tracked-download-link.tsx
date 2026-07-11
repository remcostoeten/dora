'use client'

import posthog from 'posthog-js'

export function TrackedDownloadLink({
    href,
    label,
    platform,
    className
}: {
    href: string
    label: string
    platform: string
    className: string
}) {
    return (
        <a
            className={className}
            href={href}
            rel="noreferrer"
            target="_blank"
            onClick={() =>
                posthog.capture('downloads_page_format_selected', {
                    platform,
                    format: label
                })
            }
        >
            {label}
        </a>
    )
}

import type { ReactNode } from 'react'

export function ScrollReveal({
    children,
    className = '',
}: {
    children: ReactNode
    className?: string
    delay?: number
    rootMargin?: string
}) {
    return <div className={className}>{children}</div>
}

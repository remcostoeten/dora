import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

interface StatBoxProps {
    icon: LucideIcon
    label: string
    children: ReactNode
    href?: string
    className?: string
    noBorder?: boolean
}

export function StatBox({
    icon: Icon,
    label,
    children,
    href,
    className = '',
    noBorder = false
}: StatBoxProps) {
    const content = (
        <>
            <div className="flex items-center gap-2 text-[#4a4a4a] text-xs uppercase tracking-wider mb-1">
                <Icon className="w-3 h-3" />
                {label}
            </div>
            <div className="text-[#8a8a8a] text-sm">{children}</div>
        </>
    )

    const baseClasses = `px-5 py-4 ${!noBorder ? 'border-r border-[#1a1a1a]' : ''} ${className}`

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${baseClasses} hover:bg-[#111] transition-colors duration-200 group`}
            >
                <div className="flex items-center gap-2 text-[#4a4a4a] text-xs uppercase tracking-wider mb-1 group-hover:text-[#5a5a5a] transition-colors">
                    <Icon className="w-3 h-3" />
                    {label}
                </div>
                <div className="text-[#8a8a8a] text-sm group-hover:text-[#9a9a9a] transition-colors">
                    {children}
                </div>
            </a>
        )
    }

    return <div className={baseClasses}>{content}</div>
}

interface StatBoxGroupProps {
    children: ReactNode
    className?: string
    noBorder?: boolean
}

export function StatBoxGroup({
    children,
    className = '',
    noBorder = false
}: StatBoxGroupProps) {
    return (
        <div
            className={`px-5 py-4 ${!noBorder ? 'border-r border-[#1a1a1a]' : ''} ${className}`}
        >
            {children}
        </div>
    )
}

interface StatItemProps {
    icon: LucideIcon
    label: string
    children: ReactNode
    href?: string
    small?: boolean
}

export function StatItem({
    icon: Icon,
    label,
    children,
    href,
    small = false
}: StatItemProps) {
    const Wrapper = href ? 'a' : 'div'
    const wrapperProps = href
        ? { href, target: '_blank', rel: 'noopener noreferrer' as const }
        : {}

    return (
        <Wrapper
            {...wrapperProps}
            className={`${small ? 'mb-2 last:mb-0' : ''} ${href ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''}`}
        >
            <div className="flex items-center gap-2 text-[#4a4a4a] text-[10px] uppercase tracking-wider mb-0.5">
                <Icon className="w-2.5 h-2.5" />
                {label}
            </div>
            <div className={`text-[#8a8a8a] ${small ? 'text-xs' : 'text-sm'}`}>
                {children}
            </div>
        </Wrapper>
    )
}

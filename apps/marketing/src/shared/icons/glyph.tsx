import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/shared/helpers/cn'
import { iconMotions, type MotionIcon, type Track } from './motion'

export type IconProps = {
    className?: string
}

type GlyphProps = IconProps & {
    name: string
    children: ReactNode
}

type PartProps = {
    icon: MotionIcon
    part: string
    children: ReactNode
}

export function Glyph({ name, className, children }: GlyphProps) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            overflow="visible"
            data-icon={name}
            className={cn('size-4 shrink-0', className)}
        >
            {children}
        </svg>
    )
}

function originStyle(track: Track | undefined): CSSProperties | undefined {
    if (!track) return undefined
    const [x, y] = track.origin
    return { transformBox: 'view-box', transformOrigin: `${x}px ${y}px` }
}

export function Part({ icon, part, children }: PartProps) {
    const tracks: readonly Track[] = iconMotions[icon]
    return (
        <g
            data-part={part}
            style={originStyle(tracks.find((track) => track.part === part))}
        >
            {children}
        </g>
    )
}

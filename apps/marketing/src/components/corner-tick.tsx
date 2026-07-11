import type { CSSProperties } from 'react'

/**
 * Rose corner bracket used to frame the modular sections across the marketing
 * page (header, hero, features, footer). Position it on a relatively-positioned
 * frame with the standard `-translate-*` offsets so it straddles the corner.
 */
export function CornerTick({
    className,
    style
}: {
    className: string
    style?: CSSProperties
}) {
    return (
        <span
            aria-hidden
            className={`pointer-events-none absolute z-10 size-[11px] ${className}`}
            style={style}
        >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-brand-300/50" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-brand-300/50" />
        </span>
    )
}

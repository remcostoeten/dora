/**
 * Rose corner bracket used to frame the modular sections across the marketing
 * page (header, hero, features, footer). Position it on a relatively-positioned
 * frame with the standard `-translate-*` offsets so it straddles the corner.
 */
export function CornerTick({ className }: { className: string }) {
    return (
        <span
            aria-hidden
            className={`pointer-events-none absolute z-10 size-[11px] ${className}`}
        >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#e3b2b3]/50" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#e3b2b3]/50" />
        </span>
    )
}

'use client'

/* ---------------------------------------------------------------------------
 * CardAura — a living ambient backdrop for the workflow cards. Two soft color
 * blobs (purple + rose) drift in counter-phase behind the content. Pauses when
 * the card is inactive (off-screen / reduced motion) so it costs nothing idle.
 * ------------------------------------------------------------------------- */
export function CardAura({ active }: { active: boolean }) {
    const playState = active ? 'running' : 'paused'
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
        >
            <span
                className="absolute left-[22%] top-[34%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                    background:
                        'radial-gradient(circle, color-mix(in srgb, var(--color-brand-600) 18%, transparent), transparent 70%)',
                    animation: 'auraDrift 15s ease-in-out infinite',
                    animationPlayState: playState
                }}
            />
            <span
                className="absolute right-[18%] top-[58%] h-44 w-44 translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                    background:
                        'radial-gradient(circle, color-mix(in srgb, var(--color-brand-300) 15%, transparent), transparent 70%)',
                    animation: 'auraDrift 19s ease-in-out infinite reverse',
                    animationPlayState: playState
                }}
            />
        </div>
    )
}

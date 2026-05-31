'use client'

import { Download } from 'lucide-react'

import dynamic from 'next/dynamic'
import { CornerTick } from '@/components/corner-tick'
import { useInView } from '@/shared/hooks/use-in-view'

const InteractiveCube = dynamic(
    () =>
        import('@/components/interactive-cube').then((m) => m.InteractiveCube),
    { ssr: false }
)

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

function HeroText() {
    const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 })
    const enter = (delay: number, y = 14) => ({
        opacity: inView ? 1 : 0,
        transform: inView ? 'translate3d(0,0,0)' : `translate3d(0,${y}px,0)`,
        transition: `opacity 520ms ${EASE_OUT} ${delay}ms, transform 560ms ${EASE_OUT} ${delay}ms`,
        willChange: 'transform, opacity'
    })

    return (
        <div ref={ref} className="relative z-[3] min-w-0 max-w-[560px]">
            <h1
                className="font-pixel text-[clamp(2.2rem,4.6vw,3.6rem)] font-[400] leading-[1.05] tracking-[-0.02em] text-foreground max-w-[560px]"
                style={enter(90)}
            >
                The database
                <br />
                <span className="text-[#f5c0c0] [text-shadow:0_0_18px_rgba(245,192,192,0.45)]">
                    explorah.
                </span>
            </h1>
            <p
                className="mt-6 text-[15px] leading-relaxed text-muted-foreground max-w-[460px] font-mono"
                style={enter(200)}
            >
                Dora is a native, keyboard-first SQL workbench for developers
                who think in tables. Browse millions of rows, edit live, ship
                faster.
            </p>
            <div
                className="mt-10 flex items-center gap-4 flex-wrap"
                style={enter(310)}
            >
                <a
                    href="/downloads"
                    className="inline-flex items-center gap-2 px-5 py-3 text-[13px] font-mono uppercase tracking-[0.14em] border transition-colors hover:bg-[rgba(173,142,182,0.08)]"
                    style={{
                        borderColor: 'rgba(173,142,182,0.5)',
                        color: '#ad8eb6'
                    }}
                >
                    <Download className="h-3.5 w-3.5" />
                    Download .dmg
                </a>
            </div>
        </div>
    )
}

function HeroInteractive() {
    return (
        <div className="hero-cube-stage relative z-[1] flex min-h-[430px] items-center justify-center overflow-visible border-0 outline-none sm:min-h-[520px] lg:min-h-[580px] [&_*]:outline-none">
            <div className="hero-cube-stage relative h-[430px] w-full overflow-visible border-0 outline-none sm:h-[520px] lg:h-[580px]">
                <InteractiveCube className="absolute left-1/2 top-1/2 size-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 sm:size-[720px] lg:size-[clamp(760px,48vw,920px)]" />
            </div>
        </div>
    )
}

export function Hero({ className = '' }: { className?: string }) {
    return (
        <section
            id="hero"
            className={`hero-frame relative z-10 overflow-visible ${className}`}
        >
            <div className="hero-frame relative overflow-visible border-x border-t border-[#3a3138] px-6 sm:px-8">
                <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
                <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
                <div className="hero-frame grid min-w-0 grid-cols-1 items-center gap-10 overflow-visible pt-[64px] pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <HeroText />
                    <HeroInteractive />
                </div>
            </div>
        </section>
    )
}

'use client'

import { useRef, useEffect, useState } from 'react'

import { readThemeRgb } from '@/shared/lib/theme-color'

import { useGate, type Motion } from './use-scroll-motion'

const PARTICLES = [
    { left: '28%', top: '24%', size: 2, opacity: 0.45 },
    { left: '66%', top: '22%', size: 1.5, opacity: 0.34 },
    { left: '74%', top: '45%', size: 2, opacity: 0.4 },
    { left: '36%', top: '55%', size: 1.5, opacity: 0.3 },
    { left: '57%', top: '64%', size: 1, opacity: 0.42 }
] as const

/* ---------------------------------------------------------------------------
 * Rust-Native — orbit animation; orbit speed reacts to scroll + hover.
 * ------------------------------------------------------------------------- */
export function NativePerformanceCard({
    animate,
    motion
}: {
    animate: boolean
    motion: Motion
}) {
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)
    const [isHovered, setIsHovered] = useState(false)
    const hoverRef = useRef(false)
    const gate = useGate(rootRef)

    useEffect(() => {
        hoverRef.current = isHovered
    }, [isHovered])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        const cx = rect.width / 2
        const cy = rect.height / 2
        let time = 0

        const [br, bg, bb] = readThemeRgb('--color-line-strong', canvas)
        const [ar, ag, ab] = readThemeRgb('--color-brand-300', canvas)
        const [cr, cg, cb] = readThemeRgb('--color-line', canvas)

        const draw = (running: boolean) => {
            const vel = running ? Math.abs(motion.velocityRef.current ?? 0) : 0
            // scroll only nudges the spin speed; colour responds to hover only, so
            // it never blinks or flashes while scrolling
            time += running
                ? (hoverRef.current ? 0.024 : 0.008) + vel * 0.004
                : 0
            const active = hoverRef.current
            ctx.clearRect(0, 0, rect.width, rect.height)

            // autonomous phase so the nodes pulse green on their own, scroll-independent
            const t = running ? performance.now() / 1000 : 0.75

            const orbits = [30, 45, 60]
            orbits.forEach((radius, idx) => {
                // each node pulses green on its own staggered cycle
                const pulse = (Math.sin(t * 1.6 - idx * 1.1) + 1) / 2 // 0..1
                const lit = active ? 1 : pulse * pulse
                const r = Math.round(br + lit * (ar - br))
                const g = Math.round(bg + lit * (ag - bg))
                const b = Math.round(bb + lit * (ab - bb))
                const node = `rgb(${r}, ${g}, ${b})`

                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${0.05 + lit * 0.15})`
                ctx.setLineDash([4, 4])
                ctx.lineWidth = 1
                ctx.stroke()
                ctx.setLineDash([])

                const angle = time * (1 - idx * 0.2) + idx * Math.PI * 0.7
                const px = cx + Math.cos(angle) * radius
                const py = cy + Math.sin(angle) * radius
                ctx.beginPath()
                ctx.arc(px, py, 3 + lit * 1.2, 0, Math.PI * 2)
                ctx.fillStyle = node
                ctx.fill()
            })

            const corePulse = (Math.sin(t * 1.6) + 1) / 2
            const coreLit = active ? 1 : corePulse * corePulse
            ctx.beginPath()
            ctx.arc(cx, cy, 6, 0, Math.PI * 2)
            ctx.fillStyle = `rgb(${Math.round(cr + coreLit * (ar - cr))}, ${Math.round(cg + coreLit * (ag - cg))}, ${Math.round(cb + coreLit * (ab - cb))})`
            ctx.fill()

            if (running) animationRef.current = requestAnimationFrame(loop)
        }

        const loop = () => {
            draw(animate && gate.activeRef.current && motion.activeRef.current)
        }

        const canRun = animate && gate.active && motion.activeRef.current
        draw(canRun)
        if (canRun) animationRef.current = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(animationRef.current)
    }, [animate, motion, gate.active, gate.activeRef])

    return (
        <div ref={rootRef} className="relative h-full flex flex-col overflow-hidden">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[38%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-75 blur-2xl"
                style={{
                    background:
                        'radial-gradient(circle, color-mix(in srgb, var(--color-brand-300) 13%, transparent) 0%, color-mix(in srgb, var(--color-brand-600) 5%, transparent) 38%, transparent 70%)'
                }}
            />
            {PARTICLES.map((particle, index) => (
                <span
                    aria-hidden
                    key={`${particle.left}-${particle.top}`}
                    className="pointer-events-none absolute rounded-full bg-brand-200"
                    style={{
                        left: particle.left,
                        top: particle.top,
                        width: particle.size,
                        height: particle.size,
                        opacity: particle.opacity,
                        animation: `particleFloat ${3.8 + index * 0.55}s cubic-bezier(0.23, 1, 0.32, 1) ${index * 120}ms infinite alternate`
                    }}
                />
            ))}
            <div
                className="relative flex-1 flex items-center justify-center cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <canvas ref={canvasRef} className="w-32 h-32" />
            </div>
            <div className="relative px-5 pb-5">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    SSH Tunneling
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                    Reach private databases behind firewalls through encrypted
                    SSH tunnels, no VPN required.
                </p>
            </div>
        </div>
    )
}

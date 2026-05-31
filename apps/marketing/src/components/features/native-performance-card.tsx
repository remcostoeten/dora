'use client'

import { useRef, useEffect, useState } from 'react'

import type { Motion } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Rust-Native — orbit animation; orbit speed reacts to scroll + hover.
 * ------------------------------------------------------------------------- */
export function NativePerformanceCard({ motion }: { motion: Motion }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)
    const [isHovered, setIsHovered] = useState(false)
    const hoverRef = useRef(false)

    useEffect(() => {
        hoverRef.current = isHovered
    }, [isHovered])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        const cx = rect.width / 2
        const cy = rect.height / 2
        let time = 0

        const animate = () => {
            const vel = Math.abs(motion.velocityRef.current ?? 0)
            // scroll only nudges the spin speed; colour responds to hover only, so
            // it never blinks or flashes while scrolling
            time += (hoverRef.current ? 0.024 : 0.008) + vel * 0.05
            const active = hoverRef.current
            ctx.clearRect(0, 0, rect.width, rect.height)

            // autonomous phase so the nodes pulse green on their own, scroll-independent
            const t = performance.now() / 1000

            const orbits = [30, 45, 60]
            orbits.forEach((radius, idx) => {
                // each node pulses green on its own staggered cycle
                const pulse = (Math.sin(t * 1.6 - idx * 1.1) + 1) / 2 // 0..1
                const lit = active ? 1 : pulse * pulse
                // interpolate from neutral grey (#3a3a3a) to rose (#e3b2b3)
                const r = Math.round(58 + lit * (227 - 58))
                const g = Math.round(58 + lit * (178 - 58))
                const b = Math.round(58 + lit * (179 - 58))
                const node = `rgb(${r}, ${g}, ${b})`

                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.strokeStyle = `rgba(227,178,179,${0.05 + lit * 0.15})`
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
            ctx.fillStyle = `rgb(${Math.round(42 + coreLit * (227 - 42))}, ${Math.round(42 + coreLit * (178 - 42))}, ${Math.round(42 + coreLit * (179 - 42))})`
            ctx.fill()

            animationRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationRef.current)
    }, [motion])

    return (
        <div className="h-full flex flex-col">
            <div
                className="flex-1 flex items-center justify-center cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <canvas ref={canvasRef} className="w-32 h-32" />
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Rust-Native
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Edge-optimized engine. Instant queries. Orchestrated
                    container management.
                </p>
            </div>
        </div>
    )
}

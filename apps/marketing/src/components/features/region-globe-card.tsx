'use client'

import { useRef, useEffect, useState } from 'react'

import type { Motion } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Connect Anywhere — wireframe globe; rotation speed reacts to scroll.
 * ------------------------------------------------------------------------- */
export function RegionGlobeCard({ motion }: { motion: Motion }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
    const rotationRef = useRef(0)
    const animationRef = useRef<number>(0)

    const regions = [
        { name: 'Local', angle: 0, radius: 0.35 },
        { name: 'Neon', angle: Math.PI * 0.5, radius: 0.45 },
        { name: 'Turso', angle: Math.PI, radius: 0.4 },
        { name: 'SSH', angle: Math.PI * 1.5, radius: 0.5 }
    ]

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
        const cy = rect.height / 2 - 10
        const baseRadius = Math.min(rect.width, rect.height) * 0.35

        const animate = () => {
            const vel = motion.velocityRef.current ?? 0
            // gently drifts at rest; scrolling just nudges the rotation speed
            rotationRef.current += 0.0025 + vel * 0.05
            // autonomous phase that always advances, independent of scroll, so the
            // colour highlight travels around the globe on its own
            const t = performance.now() / 1000
            ctx.clearRect(0, 0, rect.width, rect.height)

            for (let i = 0; i < 3; i++) {
                ctx.beginPath()
                ctx.ellipse(
                    cx,
                    cy,
                    baseRadius,
                    (baseRadius * 0.3 * (i + 1)) / 3,
                    0,
                    0,
                    Math.PI * 2
                )
                ctx.strokeStyle = '#2b252c'
                ctx.lineWidth = 1
                ctx.stroke()
            }

            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI + rotationRef.current
                // a rose glow sweeps smoothly from one meridian to the next over time
                const glow = (Math.sin(t * 1.4 - i * 0.8) + 1) / 2 // 0..1
                const g2 = glow * glow
                // interpolate from the warm-dark base (#2b252c) to rose (#e3b2b3)
                const gr = Math.round(43 + g2 * (227 - 43))
                const gg = Math.round(37 + g2 * (178 - 37))
                const gb = Math.round(44 + g2 * (179 - 44))
                ctx.beginPath()
                ctx.ellipse(
                    cx,
                    cy,
                    baseRadius * Math.abs(Math.cos(angle)),
                    baseRadius,
                    Math.PI / 2,
                    0,
                    Math.PI * 2
                )
                ctx.strokeStyle = `rgb(${gr}, ${gg}, ${gb})`
                ctx.lineWidth = 1 + glow * glow * 0.6
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
            ctx.strokeStyle = '#3a3138'
            ctx.lineWidth = 1
            ctx.stroke()

            animationRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationRef.current)
    }, [motion])

    return (
        <div className="h-full flex flex-col relative">
            <div className="flex-1 relative">
                <canvas ref={canvasRef} className="w-full h-full" />
                {regions.map((region) => {
                    const x = 50 + Math.cos(region.angle) * region.radius * 80
                    const y = 45 + Math.sin(region.angle) * region.radius * 50
                    return (
                        <div
                            key={region.name}
                            onMouseEnter={() => setHoveredRegion(region.name)}
                            onMouseLeave={() => setHoveredRegion(null)}
                            className="absolute cursor-pointer transition-all duration-200"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            <div
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${
                                    hoveredRegion === region.name
                                        ? 'border-[#e3b2b3]/50 bg-[#161218]'
                                        : 'border-[#2b252c] bg-[#161218]/80'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                        hoveredRegion === region.name
                                            ? 'bg-[#e3b2b3]'
                                            : 'bg-[#3a3a3a]'
                                    }`}
                                />
                                <span className="text-[9px] text-[#5a5a5a] font-mono">
                                    {region.name}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Connect Anywhere
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Local, Neon, Turso, or over SSH. Connect to databases
                    wherever they run.
                </p>
            </div>
        </div>
    )
}

'use client'

import { useEffect, useRef } from 'react'

import { readThemeRgb } from '@/shared/lib/theme-color'

type Props = {
    className?: string
}

type TVector = [number, number, number]
type TPoint = { x: number; y: number; z: number }

const VERTICES: TVector[] = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
]

const EDGES = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
]

const ENGINES = [
    { name: 'POSTGRES', stat: '1.2ms', position: [0, 0, 1] as TVector },
    { name: 'SQLITE', stat: '0.4ms', position: [0, 0, -1] as TVector },
    { name: 'LIBSQL', stat: '0.8ms', position: [1, 0, 0] as TVector },
    { name: 'DUCKDB', stat: '2.1ms', position: [-1, 0, 0] as TVector },
    { name: 'MYSQL', stat: '1.7ms', position: [0, 1, 0] as TVector },
    { name: 'TURSO', stat: '0.6ms', position: [0, -1, 0] as TVector }
]

const FACES = [
    { vertices: [4, 5, 6, 7], engine: 0 },
    { vertices: [1, 0, 3, 2], engine: 1 },
    { vertices: [5, 1, 2, 6], engine: 2 },
    { vertices: [0, 4, 7, 3], engine: 3 },
    { vertices: [3, 7, 6, 2], engine: 4 },
    { vertices: [0, 1, 5, 4], engine: 5 }
]

const CORE_EDGES = [
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5]
]

function rgba(color: number[], alpha: number) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
}

function rotate(point: TVector, x: number, y: number): TVector {
    const cosX = Math.cos(x)
    const sinX = Math.sin(x)
    const cosY = Math.cos(y)
    const sinY = Math.sin(y)
    const y1 = point[1] * cosX - point[2] * sinX
    const z1 = point[1] * sinX + point[2] * cosX

    return [point[0] * cosY + z1 * sinY, y1, -point[0] * sinY + z1 * cosY]
}

function project(
    point: TVector,
    centerX: number,
    centerY: number,
    scale: number
): TPoint {
    const perspective = 4.8 / (5.5 - point[2])
    return {
        x: centerX + point[0] * scale * perspective,
        y: centerY + point[1] * scale * perspective,
        z: point[2]
    }
}

function drawLoop(
    ctx: CanvasRenderingContext2D,
    points: TPoint[],
    color: string,
    width = 1
) {
    ctx.beginPath()
    points.forEach(function addPoint(point, index) {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
}

function facePoint(points: TPoint[], u: number, v: number): TPoint {
    const topX = points[0].x + (points[1].x - points[0].x) * u
    const topY = points[0].y + (points[1].y - points[0].y) * u
    const bottomX = points[3].x + (points[2].x - points[3].x) * u
    const bottomY = points[3].y + (points[2].y - points[3].y) * u
    return {
        x: topX + (bottomX - topX) * v,
        y: topY + (bottomY - topY) * v,
        z: 0
    }
}

export function InteractiveCube({ className = '' }: Props) {
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const frameRef = useRef(0)
    const rotationRef = useRef({ x: -0.38, y: 0.62 })
    const pointerRef = useRef({ x: 0, y: 0, active: false })
    const dragRef = useRef({ active: false, x: 0, y: 0 })

    useEffect(function startRenderer() {
        const rootElement = rootRef.current
        const canvasElement = canvasRef.current
        if (!rootElement || !canvasElement) return

        const context = canvasElement.getContext('2d')
        if (!context) return

        const root: HTMLDivElement = rootElement
        const canvas: HTMLCanvasElement = canvasElement
        const ctx: CanvasRenderingContext2D = context

        const foreground = readThemeRgb('--color-foreground', canvas)
        const brand = readThemeRgb('--color-brand-300', canvas)
        const line = readThemeRgb('--color-line-strong', canvas)
        let active = true
        let width = 0
        let height = 0
        let lastTime = performance.now()

        const particles = Array.from(
            { length: 48 },
            function makeParticle(_, index) {
                const angle = index * 2.39996
                const radius = 1.45 + ((index * 17) % 23) / 28
                return [
                    Math.cos(angle) * radius,
                    Math.sin(angle * 1.7) * radius * 0.68,
                    Math.sin(angle) * radius
                ] as TVector
            }
        )

        function resize() {
            const rect = root.getBoundingClientRect()
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
            width = rect.width
            height = rect.height
            canvas.width = Math.max(1, Math.round(width * dpr))
            canvas.height = Math.max(1, Math.round(height * dpr))
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            draw(performance.now())
        }

        function drawRing(
            rotationX: number,
            rotationY: number,
            radius: number,
            color: string,
            centerX: number,
            centerY: number,
            scale: number
        ) {
            const points: TPoint[] = []
            for (let index = 0; index < 72; index++) {
                const angle = (index / 72) * Math.PI * 2
                const point: TVector = [
                    Math.cos(angle) * radius,
                    0,
                    Math.sin(angle) * radius
                ]
                points.push(
                    project(
                        rotate(point, rotationX, rotationY),
                        centerX,
                        centerY,
                        scale
                    )
                )
            }
            drawLoop(ctx, points, color)
        }

        function draw(now: number) {
            const delta = Math.min(0.04, (now - lastTime) / 1000)
            lastTime = now
            const rotation = rotationRef.current
            const pointer = pointerRef.current

            if (active) {
                rotation.y += delta * (pointer.active ? 0.55 : 0.24)
                rotation.x += delta * 0.07
            }

            ctx.clearRect(0, 0, width, height)
            const centerX = width / 2
            const centerY = height / 2
            const scale = Math.min(width, height) * 0.19
            const x = rotation.x - pointer.y * 0.16
            const y = rotation.y + pointer.x * 0.22

            const gradient = ctx.createRadialGradient(
                centerX,
                centerY,
                0,
                centerX,
                centerY,
                scale * 2.4
            )
            gradient.addColorStop(0, rgba(brand, 0.12))
            gradient.addColorStop(1, rgba(brand, 0))
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, width, height)

            particles.forEach(function drawParticle(particle, index) {
                const rotated = rotate(particle, x * 0.45, y * 0.7)
                const point = project(rotated, centerX, centerY, scale)
                const pulse = 0.2 + ((index * 13) % 10) / 22
                ctx.fillStyle = rgba(foreground, pulse)
                ctx.fillRect(point.x, point.y, 1.2, 1.2)
            })

            // Query packets rise through the center; their uneven spacing makes
            // the stream read as live traffic rather than a decorative axis.
            for (let index = 0; index < 18; index++) {
                const progress = ((now * 0.00018 + index / 18) % 1) * 2 - 1
                const packet = rotate(
                    [
                        Math.sin(index * 4.7) * 0.045,
                        progress * 1.65,
                        Math.cos(index * 3.1) * 0.045
                    ],
                    x,
                    y
                )
                const point = project(packet, centerX, centerY, scale)
                const packetSize = index % 4 === 0 ? 3 : 1.5
                ctx.fillStyle = rgba(brand, 0.42 + (index % 3) * 0.16)
                ctx.fillRect(
                    point.x - packetSize / 2,
                    point.y - packetSize / 2,
                    packetSize,
                    packetSize
                )
            }

            drawRing(
                x + 0.12,
                y,
                1.52,
                rgba(brand, 0.52),
                centerX,
                centerY,
                scale
            )
            drawRing(
                x + Math.PI / 2.5,
                -y * 0.65,
                1.7,
                rgba(line, 0.36),
                centerX,
                centerY,
                scale
            )

            const projected = VERTICES.map(function transformVertex(vertex) {
                return project(rotate(vertex, x, y), centerX, centerY, scale)
            })

            // The original hero's database cards are rebuilt directly in the
            // projected faces: scan lines, status rails, glyphs and live stats.
            FACES.forEach(function drawFace(face) {
                const engine = ENGINES[face.engine]
                const normal = rotate(engine.position, x, y)
                if (normal[2] < 0.04) return
                const points = face.vertices.map(function getVertex(index) {
                    return projected[index]
                })
                const opacity = 0.035 + normal[2] * 0.055

                ctx.beginPath()
                points.forEach(function addFacePoint(point, index) {
                    if (index === 0) ctx.moveTo(point.x, point.y)
                    else ctx.lineTo(point.x, point.y)
                })
                ctx.closePath()
                ctx.fillStyle = rgba(brand, opacity)
                ctx.fill()

                for (let row = 1; row < 7; row++) {
                    const start = facePoint(points, 0.08, row / 8)
                    const finish = facePoint(points, 0.92, row / 8)
                    ctx.beginPath()
                    ctx.moveTo(start.x, start.y)
                    ctx.lineTo(finish.x, finish.y)
                    ctx.strokeStyle = rgba(foreground, 0.055 + normal[2] * 0.04)
                    ctx.lineWidth = 0.6
                    ctx.stroke()
                }

                const railStart = facePoint(points, 0.09, 0.14)
                const railEnd = facePoint(points, 0.91, 0.14)
                ctx.beginPath()
                ctx.moveTo(railStart.x, railStart.y)
                ctx.lineTo(railEnd.x, railEnd.y)
                ctx.strokeStyle = rgba(brand, 0.28 + normal[2] * 0.2)
                ctx.lineWidth = 1
                ctx.stroke()

                const glyph = facePoint(points, 0.22, 0.48)
                const glyphRadius = Math.max(
                    3,
                    Math.hypot(
                        points[1].x - points[0].x,
                        points[1].y - points[0].y
                    ) * 0.055
                )
                ctx.beginPath()
                ctx.arc(glyph.x, glyph.y, glyphRadius, 0, Math.PI * 2)
                ctx.strokeStyle = rgba(foreground, 0.42 + normal[2] * 0.35)
                ctx.lineWidth = 1
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(glyph.x - glyphRadius * 0.55, glyph.y)
                ctx.lineTo(glyph.x + glyphRadius * 0.55, glyph.y)
                ctx.moveTo(glyph.x, glyph.y - glyphRadius * 0.55)
                ctx.lineTo(glyph.x, glyph.y + glyphRadius * 0.55)
                ctx.stroke()

                const status = facePoint(points, 0.74, 0.48)
                ctx.textAlign = 'center'
                ctx.font = `${Math.max(7, glyphRadius * 0.8)}px ui-monospace, monospace`
                ctx.fillStyle = rgba(foreground, 0.38 + normal[2] * 0.4)
                ctx.fillText(engine.stat.toUpperCase(), status.x, status.y + 2)

                const live = facePoint(points, 0.77, 0.82)
                ctx.fillStyle = rgba(brand, 0.58 + normal[2] * 0.25)
                ctx.fillRect(live.x - 12, live.y - 1, 3, 3)
                ctx.textAlign = 'left'
                ctx.font = '7px ui-monospace, monospace'
                ctx.fillText('LIVE', live.x - 6, live.y + 2)
            })

            // A counter-rotating schema core restores the layered mechanical
            // depth of the WebGL version without another rendering runtime.
            const coreX = -x * 0.72
            const coreY = -y * 0.88
            const core = VERTICES.map(function projectCore(vertex) {
                const scaled = vertex.map(function scaleVertex(value) {
                    return value * 0.43
                }) as TVector
                return project(
                    rotate(scaled, coreX, coreY),
                    centerX,
                    centerY,
                    scale
                )
            })
            EDGES.forEach(function drawCoreEdge(edge) {
                ctx.beginPath()
                ctx.moveTo(core[edge[0]].x, core[edge[0]].y)
                ctx.lineTo(core[edge[1]].x, core[edge[1]].y)
                ctx.strokeStyle = rgba(brand, 0.34)
                ctx.lineWidth = 0.8
                ctx.stroke()
            })

            const coreShape: TVector[] = [
                [0, 0.35, 0],
                [0, -0.35, 0],
                [0.35, 0, 0],
                [-0.35, 0, 0],
                [0, 0, 0.35],
                [0, 0, -0.35]
            ]
            const corePoints = coreShape.map(function projectCorePoint(point) {
                return project(
                    rotate(point, -coreX, coreY),
                    centerX,
                    centerY,
                    scale
                )
            })
            CORE_EDGES.forEach(function drawCoreLine(edge) {
                ctx.beginPath()
                ctx.moveTo(corePoints[edge[0]].x, corePoints[edge[0]].y)
                ctx.lineTo(corePoints[edge[1]].x, corePoints[edge[1]].y)
                ctx.strokeStyle = rgba(foreground, 0.46)
                ctx.lineWidth = 0.8
                ctx.stroke()
            })

            EDGES.map(function mapEdge(edge) {
                const start = projected[edge[0]]
                const end = projected[edge[1]]
                return { start, end, depth: (start.z + end.z) / 2 }
            })
                .sort(function sortEdges(a, b) {
                    return a.depth - b.depth
                })
                .forEach(function drawEdge(edge) {
                    const alpha = edge.depth > 0 ? 0.9 : 0.28
                    ctx.beginPath()
                    ctx.moveTo(edge.start.x, edge.start.y)
                    ctx.lineTo(edge.end.x, edge.end.y)
                    ctx.strokeStyle = rgba(foreground, alpha)
                    ctx.lineWidth = edge.depth > 0 ? 1.4 : 0.8
                    ctx.stroke()
                })

            // Five orbiting shards represent query replicas moving between
            // engines. Diamond outlines stay crisp even on low-DPI displays.
            for (let index = 0; index < 5; index++) {
                const angle = now * 0.00024 * (1 + index * 0.08) + index * 1.257
                const shard = rotate(
                    [
                        Math.cos(angle) * (1.38 + (index % 2) * 0.16),
                        Math.sin(angle * 0.7 + index) * 0.42,
                        Math.sin(angle) * (1.38 + (index % 2) * 0.16)
                    ],
                    x * 0.35,
                    y * 0.3
                )
                const point = project(shard, centerX, centerY, scale)
                const shardSize = 3.5 + (index % 3)
                ctx.beginPath()
                ctx.moveTo(point.x, point.y - shardSize)
                ctx.lineTo(point.x + shardSize, point.y)
                ctx.lineTo(point.x, point.y + shardSize)
                ctx.lineTo(point.x - shardSize, point.y)
                ctx.closePath()
                ctx.fillStyle = rgba(brand, 0.12)
                ctx.fill()
                ctx.strokeStyle = rgba(foreground, 0.48)
                ctx.lineWidth = 0.8
                ctx.stroke()
            }

            ENGINES.forEach(function drawEngine(engine) {
                const normal = rotate(engine.position, x, y)
                if (normal[2] < 0.12) return
                const anchor = project(normal, centerX, centerY, scale)
                const labelVector = engine.position.map(function expand(value) {
                    return value * 1.58
                }) as TVector
                const label = project(
                    rotate(labelVector, x, y),
                    centerX,
                    centerY,
                    scale
                )
                const align = label.x < centerX ? 'right' : 'left'
                const direction = align === 'right' ? -1 : 1

                ctx.beginPath()
                ctx.moveTo(anchor.x, anchor.y)
                ctx.lineTo(label.x, label.y)
                ctx.lineTo(label.x + direction * 18, label.y)
                ctx.strokeStyle = rgba(brand, 0.48)
                ctx.lineWidth = 0.8
                ctx.stroke()

                ctx.textAlign = align
                ctx.font = '10px ui-monospace, monospace'
                ctx.fillStyle = rgba(foreground, 0.88)
                ctx.fillText(
                    `${engine.name}  ${engine.stat}`,
                    label.x + direction * 23,
                    label.y + 3
                )
            })

            if (active) {
                frameRef.current = requestAnimationFrame(draw)
            }
        }

        const resizeObserver = new ResizeObserver(resize)
        const visibilityObserver = new IntersectionObserver(
            function observe(entries) {
                active = entries[0]?.isIntersecting ?? false
                cancelAnimationFrame(frameRef.current)
                draw(performance.now())
            }
        )
        resizeObserver.observe(root)
        visibilityObserver.observe(root)
        resize()

        return function stopRenderer() {
            cancelAnimationFrame(frameRef.current)
            resizeObserver.disconnect()
            visibilityObserver.disconnect()
        }
    }, [])

    function movePointer(event: React.PointerEvent<HTMLDivElement>) {
        const rect = event.currentTarget.getBoundingClientRect()
        pointerRef.current = {
            x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
            y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
            active: true
        }

        if (!dragRef.current.active) return
        rotationRef.current.x += (event.clientY - dragRef.current.y) * 0.008
        rotationRef.current.y += (event.clientX - dragRef.current.x) * 0.008
        dragRef.current.x = event.clientX
        dragRef.current.y = event.clientY
    }

    function startDrag(event: React.PointerEvent<HTMLDivElement>) {
        dragRef.current = { active: true, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.style.cursor = 'grabbing'
    }

    function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
        dragRef.current.active = false
        event.currentTarget.style.cursor = 'grab'
    }

    function leaveCube() {
        pointerRef.current = { x: 0, y: 0, active: false }
        dragRef.current.active = false
    }

    return (
        <div
            ref={rootRef}
            className={`interactive-cube relative cursor-grab select-none ${className}`}
            onPointerDown={startDrag}
            onPointerLeave={leaveCube}
            onPointerMove={movePointer}
            onPointerUp={stopDrag}
            style={{ touchAction: 'none' }}
        >
            <canvas
                ref={canvasRef}
                aria-label="Interactive database engine cube"
                className="absolute inset-0 h-full w-full"
                role="img"
            />
        </div>
    )
}

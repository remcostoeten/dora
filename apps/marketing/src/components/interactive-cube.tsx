import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import { useRef, useState, useMemo, useEffect } from 'react'
import * as THREE from 'three'

// Each face = a database engine. Eye-catching: faces are mini "cards" with
// the engine's logo silhouette, name, and a fake query latency stat.
const FACE_ENGINES = [
    { name: 'POSTGRES', glyph: 'elephant', stat: '1.2ms', coord: 'pg://01' },
    { name: 'SQLITE', glyph: 'feather', stat: '0.4ms', coord: 'sl://02' },
    { name: 'LIBSQL', glyph: 'branch', stat: '0.8ms', coord: 'ls://03' },
    { name: 'DUCKDB', glyph: 'duck', stat: '2.1ms', coord: 'dk://04' },
    { name: 'MYSQL', glyph: 'dolphin', stat: '1.7ms', coord: 'my://05' },
    { name: 'TURSO', glyph: 'wave', stat: '0.6ms', coord: 'tu://06' }
]
const FACE_LABELS = FACE_ENGINES.map((e) => e.name)
const FACE_COORDS = FACE_ENGINES.map((e) => e.coord)

/**
 * InteractiveCube — wireframe neon cube that:
 *  - auto-spins
 *  - drags with the pointer (1:1 rotation)
 *  - speeds up on hover
 *  - has 6 stripe-textured faces with neon glow edges
 *  - emits a soft pulse when clicked (face flashes)
 *  - shows orbiting face labels with connector lines projected to screen
 */

const CYAN = '#f5f5f5'
const MAGENTA = '#888888'

// Shared per-face screen-space data updated each frame inside Canvas,
// read by the SVG overlay rendered alongside.
type LabelDatum = {
    faceX: number // CSS px relative to wrap
    faceY: number
    labelX: number
    labelY: number
    opacity: number
    depth: number // 0 = far, 1 = near (normalized from projected z)
}

function drawGlyph(
    ctx: CanvasRenderingContext2D,
    kind: string,
    cx: number,
    cy: number,
    r: number
) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.strokeStyle = '#ffffff'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (kind === 'elephant') {
        ctx.beginPath()
        ctx.moveTo(-r * 0.8, -r * 0.1)
        ctx.bezierCurveTo(-r, -r * 0.9, r * 0.6, -r, r * 0.7, -r * 0.2)
        ctx.bezierCurveTo(
            r * 0.95,
            r * 0.2,
            r * 0.6,
            r * 0.7,
            r * 0.2,
            r * 0.65
        )
        ctx.lineTo(r * 0.25, r * 0.95)
        ctx.lineTo(-r * 0.05, r * 0.7)
        ctx.bezierCurveTo(
            -r * 0.5,
            r * 0.8,
            -r * 0.95,
            r * 0.4,
            -r * 0.8,
            -r * 0.1
        )
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(r * 0.25, -r * 0.1, r * 0.08, 0, Math.PI * 2)
        ctx.fill()
    } else if (kind === 'feather') {
        ctx.beginPath()
        ctx.moveTo(-r * 0.7, r * 0.7)
        ctx.bezierCurveTo(
            -r * 0.2,
            r * 0.1,
            r * 0.4,
            -r * 0.5,
            r * 0.7,
            -r * 0.7
        )
        ctx.bezierCurveTo(
            r * 0.6,
            -r * 0.2,
            r * 0.2,
            r * 0.3,
            -r * 0.4,
            r * 0.6
        )
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-r * 0.7, r * 0.7)
        ctx.lineTo(r * 0.7, -r * 0.7)
        ctx.stroke()
        for (let i = 1; i <= 5; i++) {
            const t = i / 6
            const sx = -r * 0.7 + t * r * 1.4
            const sy = r * 0.7 - t * r * 1.4
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.lineTo(sx + r * 0.18, sy - r * 0.05)
            ctx.stroke()
        }
    } else if (kind === 'branch') {
        ctx.beginPath()
        ctx.moveTo(0, r * 0.85)
        ctx.lineTo(0, 0)
        ctx.moveTo(0, 0)
        ctx.lineTo(-r * 0.6, -r * 0.5)
        ctx.lineTo(-r * 0.6, -r * 0.85)
        ctx.moveTo(0, 0)
        ctx.lineTo(r * 0.6, -r * 0.5)
        ctx.lineTo(r * 0.6, -r * 0.85)
        ctx.stroke()
        ;[
            [0, r * 0.85],
            [-r * 0.6, -r * 0.85],
            [r * 0.6, -r * 0.85],
            [0, 0]
        ].forEach(([x, y]) => {
            ctx.beginPath()
            ctx.arc(x, y, r * 0.11, 0, Math.PI * 2)
            ctx.fill()
        })
    } else if (kind === 'duck') {
        ctx.beginPath()
        ctx.arc(-r * 0.05, -r * 0.15, r * 0.45, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(r * 0.15, r * 0.45, r * 0.7, r * 0.35, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-r * 0.45, -r * 0.2)
        ctx.lineTo(-r * 0.85, -r * 0.05)
        ctx.lineTo(-r * 0.45, r * 0.05)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(-r * 0.05, -r * 0.25, r * 0.07, 0, Math.PI * 2)
        ctx.fill()
    } else if (kind === 'dolphin') {
        ctx.beginPath()
        ctx.moveTo(-r * 0.85, r * 0.3)
        ctx.bezierCurveTo(
            -r * 0.5,
            -r * 0.7,
            r * 0.4,
            -r * 0.8,
            r * 0.85,
            -r * 0.2
        )
        ctx.bezierCurveTo(
            r * 0.5,
            r * 0.1,
            r * 0.2,
            r * 0.5,
            -r * 0.2,
            r * 0.55
        )
        ctx.bezierCurveTo(
            -r * 0.5,
            r * 0.55,
            -r * 0.7,
            r * 0.5,
            -r * 0.85,
            r * 0.3
        )
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(r * 0.1, -r * 0.55)
        ctx.lineTo(r * 0.4, -r * 0.85)
        ctx.lineTo(r * 0.45, -r * 0.45)
        ctx.closePath()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(r * 0.55, -r * 0.2, r * 0.06, 0, Math.PI * 2)
        ctx.fill()
    } else if (kind === 'wave') {
        for (let i = 0; i < 3; i++) {
            const rr = r * (0.4 + i * 0.22)
            ctx.beginPath()
            ctx.moveTo(-rr, 0)
            for (let x = -rr; x <= rr; x += 2) {
                const y = Math.sin((x / rr) * Math.PI * 2) * r * 0.12
                ctx.lineTo(x, y)
            }
            ctx.stroke()
        }
    }
    ctx.restore()
}

function makeFaceTexture(variant: number) {
    const size = 256
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, size, size)

    ctx.strokeStyle = '#888888'
    ctx.globalAlpha = 0.18
    ctx.lineWidth = 1
    for (let y = 0; y < size; y += 4) {
        ctx.beginPath()
        ctx.moveTo(0, y + 0.5)
        ctx.lineTo(size, y + 0.5)
        ctx.stroke()
    }

    ctx.globalAlpha = 0.1
    ctx.strokeStyle = '#ffffff'
    for (let i = 0; i <= size; i += 32) {
        ctx.beginPath()
        ctx.moveTo(i + 0.5, 0)
        ctx.lineTo(i + 0.5, size)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i + 0.5)
        ctx.lineTo(size, i + 0.5)
        ctx.stroke()
    }

    ctx.globalAlpha = 0.85
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    const b = 18
    const m = 10
    const corners: [number, number, number, number, number, number][] = [
        [m, m + b, m, m, m + b, m],
        [size - m - b, m, size - m, m, size - m, m + b],
        [m, size - m - b, m, size - m, m + b, size - m],
        [size - m, size - m - b, size - m, size - m, size - m - b, size - m]
    ]
    corners.forEach(([x1, y1, x2, y2, x3, y3]) => {
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.lineTo(x3, y3)
        ctx.stroke()
    })

    const engine = FACE_ENGINES[variant]

    ctx.globalAlpha = 0.95
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px ui-monospace, monospace'
    ctx.fillText(engine.name, m + 6, m + 20)

    ctx.globalAlpha = 0.7
    ctx.font = '11px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.fillText(engine.stat, size - m - 6, m + 18)
    ctx.textAlign = 'start'

    ctx.globalAlpha = 0.95
    drawGlyph(ctx, engine.glyph, size / 2, size / 2 + 4, 56)

    ctx.globalAlpha = 0.55
    ctx.font = '10px ui-monospace, monospace'
    ctx.fillText(engine.coord, m + 6, size - m - 8)

    ctx.globalAlpha = 0.9
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    const pillW = 40
    const pillH = 14
    const pillX = size - m - 6 - pillW
    const pillY = size - m - 6 - pillH
    ctx.strokeRect(pillX, pillY, pillW, pillH)
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillText('LIVE', pillX + 12, pillY + 10)
    ctx.beginPath()
    ctx.arc(pillX + 6, pillY + 7, 2, 0, Math.PI * 2)
    ctx.fill()

    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipMapLinearFilter
    t.anisotropy = 4
    return t
}

function CubeMesh({
    spin,
    pointer,
    flash,
    flashFace,
    labelData
}: {
    spin: { x: number; y: number }
    pointer: { x: number; y: number; active: boolean }
    flash: number
    flashFace: number | null
    labelData: React.MutableRefObject<LabelDatum[]>
}) {
    const grp = useRef<THREE.Group>(null!)
    const innerRef = useRef<THREE.Group>(null!)
    const ringRef = useRef<THREE.Mesh>(null!)
    const ring2Ref = useRef<THREE.Mesh>(null!)
    const particlesRef = useRef<THREE.Points>(null!)
    const shardsRef = useRef<THREE.Group>(null!)
    const streamRef = useRef<THREE.Points>(null!)
    const auto = useRef({ x: 0, y: 0 })

    const faceTextures = useMemo(
        () => [0, 1, 2, 3, 4, 5].map((i) => makeFaceTexture(i)),
        []
    )

    // Particle field around cube
    const particleGeom = useMemo(() => {
        const g = new THREE.BufferGeometry()
        const count = 80
        const positions = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            const r = 1.4 + Math.random() * 0.9
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
            positions[i * 3 + 2] = r * Math.cos(phi)
        }
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        return g
    }, [])

    // Vertical data stream — packets flowing through the cube on the Y axis
    const streamGeom = useMemo(() => {
        const g = new THREE.BufferGeometry()
        const count = 40
        const positions = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 0.05
            positions[i * 3 + 1] = (i / count) * 4 - 2
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05
        }
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        return g
    }, [])

    // Orbiting "shard" mini cubes representing query packets / replicas
    const shards = useMemo(
        () =>
            Array.from({ length: 5 }).map((_, i) => ({
                radius: 1.55 + (i % 2) * 0.18,
                speed: 0.4 + i * 0.12,
                offset: (i / 5) * Math.PI * 2,
                tilt: (i / 5) * Math.PI,
                size: 0.08 + (i % 3) * 0.025
            })),
        []
    )

    useFrame((_, delta) => {
        if (!grp.current) return
        const speed = pointer.active ? 0.55 : 0.25
        auto.current.y += delta * speed
        auto.current.x += delta * speed * 0.35

        const targetY = auto.current.y + spin.y + pointer.x * 0.6
        const targetX = auto.current.x + spin.x - pointer.y * 0.4

        grp.current.rotation.y += (targetY - grp.current.rotation.y) * 0.12
        grp.current.rotation.x += (targetX - grp.current.rotation.x) * 0.12

        // Inner counter-rotation
        if (innerRef.current) {
            innerRef.current.rotation.y -= delta * 0.6
            innerRef.current.rotation.x += delta * 0.25
        }
        // Orbiting ring
        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 0.4
            ringRef.current.rotation.x =
                Math.sin(performance.now() * 0.0004) * 0.3
        }
        // Second tilted ring (counter-rotating)
        if (ring2Ref.current) {
            ring2Ref.current.rotation.y -= delta * 0.55
            ring2Ref.current.rotation.z =
                Math.cos(performance.now() * 0.0005) * 0.4
        }
        // Particles slow drift
        if (particlesRef.current) {
            particlesRef.current.rotation.y += delta * 0.08
        }
        // Orbiting shards
        if (shardsRef.current) {
            const t = performance.now() * 0.001
            shardsRef.current.children.forEach((child, i) => {
                const sh = shards[i]
                const angle = t * sh.speed + sh.offset
                child.position.set(
                    Math.cos(angle) * sh.radius,
                    Math.sin(angle * 0.7 + sh.tilt) * 0.5,
                    Math.sin(angle) * sh.radius
                )
                child.rotation.x += delta * 1.2
                child.rotation.y += delta * 0.8
            })
        }
        // Vertical data stream — packets flow upward, wrap around
        if (streamRef.current) {
            const pos = streamRef.current.geometry.attributes.position
                .array as Float32Array
            for (let i = 0; i < pos.length; i += 3) {
                pos[i + 1] += delta * 1.6
                if (pos[i + 1] > 2) pos[i + 1] = -2
            }
            streamRef.current.geometry.attributes.position.needsUpdate = true
        }
    })

    const s = 1.25
    const h = s / 2 + 0.001
    const faces: {
        pos: [number, number, number]
        rot: [number, number, number]
    }[] = [
        { pos: [0, 0, h], rot: [0, 0, 0] },
        { pos: [0, 0, -h], rot: [0, Math.PI, 0] },
        { pos: [h, 0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [-h, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { pos: [0, h, 0], rot: [-Math.PI / 2, 0, 0] },
        { pos: [0, -h, 0], rot: [Math.PI / 2, 0, 0] }
    ]

    return (
        <group ref={grp}>
            {/* faces */}
            {faces.map((f, i) => {
                const isFlashing = flashFace === i && flash > 0
                return (
                    <mesh key={i} position={f.pos} rotation={f.rot}>
                        <planeGeometry args={[s, s]} />
                        <meshBasicMaterial
                            map={faceTextures[i]}
                            transparent
                            opacity={isFlashing ? 1 : 0.9}
                            color={'#ffffff'}
                            depthWrite={false}
                        />
                    </mesh>
                )
            })}
            {/* outer edges */}
            <mesh>
                <boxGeometry args={[s, s, s]} />
                <meshBasicMaterial transparent opacity={0} />
                <Edges lineWidth={1.6} color={CYAN} />
            </mesh>
            {/* inner counter-rotating geometry — abstract core */}
            <group ref={innerRef}>
                <mesh scale={0.55}>
                    <boxGeometry args={[s, s, s]} />
                    <meshBasicMaterial transparent opacity={0} />
                    <Edges lineWidth={1} color={MAGENTA} />
                </mesh>
                <mesh scale={0.32}>
                    <octahedronGeometry args={[s * 0.6, 0]} />
                    <meshBasicMaterial transparent opacity={0} />
                    <Edges lineWidth={1.2} color={CYAN} />
                </mesh>
            </group>
            {/* orbiting equatorial ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[s * 0.95, 0.006, 8, 96]} />
                <meshBasicMaterial color={CYAN} transparent opacity={0.55} />
            </mesh>
            {/* second tilted ring — perpendicular plane */}
            <mesh ref={ring2Ref} rotation={[Math.PI / 2.5, 0, Math.PI / 4]}>
                <torusGeometry args={[s * 1.1, 0.004, 6, 80]} />
                <meshBasicMaterial color={MAGENTA} transparent opacity={0.45} />
            </mesh>
            {/* axis indicators */}
            <group>
                <mesh position={[s * 0.85, 0, 0]}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshBasicMaterial color={CYAN} />
                </mesh>
                <mesh position={[0, s * 0.85, 0]}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshBasicMaterial color={CYAN} />
                </mesh>
                <mesh position={[0, 0, s * 0.85]}>
                    <sphereGeometry args={[0.025, 8, 8]} />
                    <meshBasicMaterial color={CYAN} />
                </mesh>
            </group>
            {/* orbiting "shard" mini-cubes — query packets / replicas */}
            <group ref={shardsRef}>
                {shards.map((sh, i) => (
                    <mesh key={`shard-${i}`} scale={sh.size}>
                        <boxGeometry args={[1, 1, 1]} />
                        <meshBasicMaterial
                            color={CYAN}
                            transparent
                            opacity={0.15}
                        />
                        <Edges
                            lineWidth={1.2}
                            color={i % 2 === 0 ? CYAN : MAGENTA}
                        />
                    </mesh>
                ))}
            </group>
            {/* vertical data stream — packets flowing through the cube */}
            <points ref={streamRef} geometry={streamGeom}>
                <pointsMaterial
                    color={CYAN}
                    size={0.05}
                    transparent
                    opacity={0.85}
                    sizeAttenuation
                />
            </points>
            {/* particle field */}
            <points ref={particlesRef} geometry={particleGeom}>
                <pointsMaterial
                    color={CYAN}
                    size={0.018}
                    transparent
                    opacity={0.55}
                    sizeAttenuation
                />
            </points>
            {/* Floating face labels + connector tracker */}
            {faces.map((f, i) => (
                <FaceLabel
                    key={`lbl-${i}`}
                    index={i}
                    position={f.pos}
                    text={FACE_LABELS[i]}
                    parentGroup={grp}
                    labelData={labelData}
                />
            ))}
        </group>
    )
}

function FaceLabel({
    index,
    position,
    text,
    parentGroup,
    labelData
}: {
    index: number
    position: [number, number, number]
    text: string
    parentGroup: React.MutableRefObject<THREE.Group>
    labelData: React.MutableRefObject<LabelDatum[]>
}) {
    const ref = useRef<HTMLDivElement>(null)
    const { camera, size } = useThree()
    const normal = useMemo(
        () => new THREE.Vector3(...position).normalize(),
        [position]
    )
    const facePos = useMemo(() => new THREE.Vector3(...position), [position])
    const labelOffset: [number, number, number] = [
        position[0] * 1.55,
        position[1] * 1.55,
        position[2] * 1.55
    ]
    const labelPos = useMemo(() => new THREE.Vector3(...labelOffset), [])

    const worldNormal = useMemo(() => new THREE.Vector3(), [])
    const camDir = useMemo(() => new THREE.Vector3(), [])
    const projFace = useMemo(() => new THREE.Vector3(), [])
    const projLabel = useMemo(() => new THREE.Vector3(), [])

    useFrame(() => {
        if (!ref.current || !parentGroup.current) return
        const q = parentGroup.current.quaternion

        worldNormal.copy(normal).applyQuaternion(q)
        camera.getWorldDirection(camDir)
        const dot = worldNormal.dot(camDir)
        const facing = THREE.MathUtils.clamp(-dot, 0, 1)
        const opacity = Math.pow(facing, 1.3) * 0.95
        ref.current.style.opacity = String(opacity)

        // Project face center + label position to CSS pixels
        projFace.copy(facePos).applyQuaternion(q).project(camera)
        projLabel.copy(labelPos).applyQuaternion(q).project(camera)

        const fx = (projFace.x * 0.5 + 0.5) * size.width
        const fy = (-projFace.y * 0.5 + 0.5) * size.height
        const lx = (projLabel.x * 0.5 + 0.5) * size.width
        const ly = (-projLabel.y * 0.5 + 0.5) * size.height

        // projFace.z is in NDC [-1, 1]; smaller z = closer. Normalize to [0,1] near.
        const depth = THREE.MathUtils.clamp(1 - (projFace.z * 0.5 + 0.5), 0, 1)

        labelData.current[index] = {
            faceX: fx,
            faceY: fy,
            labelX: lx,
            labelY: ly,
            opacity,
            depth
        }
    })

    return (
        <Html position={labelOffset} center zIndexRange={[10, 0]}>
            <div
                ref={ref}
                className="font-mono text-[10px] uppercase tracking-[0.22em] whitespace-nowrap pointer-events-none"
                style={{
                    color: 'hsl(var(--foreground))',
                    textShadow:
                        '0 0 6px hsl(var(--background)), 0 0 12px hsl(var(--background))',
                    opacity: 0,
                    transition: 'opacity 80ms linear'
                }}
            >
                {text}
            </div>
        </Html>
    )
}

function Scene({
    spin,
    pointer,
    flash,
    flashFace,
    labelData
}: {
    spin: { x: number; y: number }
    pointer: { x: number; y: number; active: boolean }
    flash: number
    flashFace: number | null
    labelData: React.MutableRefObject<LabelDatum[]>
}) {
    const { camera } = useThree()
    useEffect(() => {
        const ortho = camera as THREE.OrthographicCamera
        ortho.zoom = 120
        ortho.updateProjectionMatrix()
    }, [camera])
    return (
        <CubeMesh
            spin={spin}
            pointer={pointer}
            flash={flash}
            flashFace={flashFace}
            labelData={labelData}
        />
    )
}

/**
 * SVG overlay that reads label data each frame and draws connector lines
 * from each visible face to its label.
 */
function ConnectorOverlay({
    labelData,
    size
}: {
    labelData: React.MutableRefObject<LabelDatum[]>
    size: { w: number; h: number }
}) {
    const pathRefs = useRef<(SVGPathElement | null)[]>([])
    const dotRefs = useRef<(SVGCircleElement | null)[]>([])
    const ringRefs = useRef<(SVGCircleElement | null)[]>([])
    // Smoothed per-face opacity, used to detect "fade in" energy for pulse + curvature.
    const smoothed = useRef<number[]>(new Array(6).fill(0))
    // Time-based pulse phase per face, advances while a face is fading in.
    const pulsePhase = useRef<number[]>(new Array(6).fill(0))

    useEffect(() => {
        let raf = 0
        let last = performance.now()
        const tick = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now

            for (let i = 0; i < 6; i++) {
                const d = labelData.current[i]
                const path = pathRefs.current[i]
                const dot = dotRefs.current[i]
                const ring = ringRefs.current[i]
                if (!path || !dot || !ring || !d) continue

                // Smooth target opacity to detect transitions
                const prev = smoothed.current[i]
                const target = d.opacity
                const next = prev + (target - prev) * Math.min(1, dt * 6)
                const delta = Math.abs(target - prev)
                smoothed.current[i] = next

                // Advance pulse phase while there's fade activity (entering OR leaving)
                // Decays naturally when stable.
                const activity = Math.min(1, delta * 18)
                pulsePhase.current[i] += dt * (3 + activity * 6)
                const pulse =
                    activity * Math.sin(pulsePhase.current[i] * Math.PI * 2)

                // Curvature: base + animated wobble during fade activity
                const dx = d.labelX - d.faceX
                const dy = d.labelY - d.faceY
                const len = Math.hypot(dx, dy) || 1
                const px = -dy / len
                const py = dx / len
                const baseCurve = Math.min(len * 0.25, 22)
                const animCurve = baseCurve * (1 + pulse * 0.35)
                const mx = (d.faceX + d.labelX) / 2 + px * animCurve
                const my = (d.faceY + d.labelY) / 2 + py * animCurve

                path.setAttribute(
                    'd',
                    `M ${d.faceX} ${d.faceY} Q ${mx} ${my} ${d.labelX} ${d.labelY}`
                )

                // Depth-based stroke width: nearer faces = thicker line
                // depth in [0,1]; map to [0.5, 1.4]px
                const sw = 0.5 + d.depth * 0.9
                path.setAttribute('stroke-width', sw.toFixed(2))
                path.style.opacity = String(d.opacity * (0.45 + d.depth * 0.25))

                // Tick dot pulse: scale grows briefly during fade activity
                const dotR =
                    1.6 * (1 + activity * 0.9 + Math.max(0, pulse) * 0.5)
                const ringR = 3.5 * (1 + activity * 0.6)
                dot.setAttribute('cx', String(d.faceX))
                dot.setAttribute('cy', String(d.faceY))
                dot.setAttribute('r', dotR.toFixed(2))
                dot.style.opacity = String(d.opacity * (0.85 + d.depth * 0.15))

                ring.setAttribute('cx', String(d.faceX))
                ring.setAttribute('cy', String(d.faceY))
                ring.setAttribute('r', ringR.toFixed(2))
                // Ring brightens with activity so it reads like a soft ping
                ring.style.opacity = String(
                    d.opacity * (0.25 + d.depth * 0.15) + activity * 0.5
                )
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [labelData])

    return (
        <svg
            className="absolute inset-0 pointer-events-none"
            width={size.w}
            height={size.h}
            style={{ overflow: 'visible' }}
        >
            {Array.from({ length: 6 }).map((_, i) => (
                <g key={i}>
                    <path
                        ref={(el) => {
                            pathRefs.current[i] = el
                        }}
                        fill="none"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={0.75}
                        strokeDasharray="2 3"
                        strokeLinecap="round"
                        style={{
                            opacity: 0,
                            transition: 'opacity 80ms linear'
                        }}
                    />
                    {/* Outer faint ring at the face anchor — pings on fade transitions */}
                    <circle
                        ref={(el) => {
                            ringRefs.current[i] = el
                        }}
                        r={3.5}
                        fill="none"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={0.6}
                        style={{
                            opacity: 0,
                            transition: 'opacity 80ms linear'
                        }}
                    />
                    {/* Solid tick dot at the face anchor — pulses on fade transitions */}
                    <circle
                        ref={(el) => {
                            dotRefs.current[i] = el
                        }}
                        r={1.6}
                        fill="hsl(var(--foreground))"
                        style={{
                            opacity: 0,
                            transition: 'opacity 80ms linear'
                        }}
                    />
                </g>
            ))}
        </svg>
    )
}

export function InteractiveCube({ className = '' }: { className?: string }) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const [spin, setSpin] = useState({ x: 0, y: 0 })
    const [pointer, setPointer] = useState({ x: 0, y: 0, active: false })
    const dragging = useRef(false)
    const last = useRef({ x: 0, y: 0 })
    const [flash, setFlash] = useState(0)
    const [flashFace, setFlashFace] = useState<number | null>(null)
    const labelData = useRef<LabelDatum[]>([])
    const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 })

    useEffect(() => {
        if (!wrapRef.current) return
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setOverlaySize({ w: width, h: height })
        })
        ro.observe(wrapRef.current)
        return () => ro.disconnect()
    }, [])

    const onMove = (e: React.PointerEvent) => {
        const rect = wrapRef.current!.getBoundingClientRect()
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
        setPointer((p) => ({ ...p, x: nx, y: ny }))

        if (dragging.current) {
            const dx = e.clientX - last.current.x
            const dy = e.clientY - last.current.y
            last.current = { x: e.clientX, y: e.clientY }
            setSpin((s) => ({ x: s.x + dy * 0.008, y: s.y + dx * 0.008 }))
        }
    }

    const onDown = (e: React.PointerEvent) => {
        dragging.current = true
        last.current = { x: e.clientX, y: e.clientY }
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
        setFlashFace(Math.floor(Math.random() * 6))
        setFlash(1)
        setTimeout(() => setFlash(0), 220)
    }
    const onUp = () => {
        dragging.current = false
    }

    return (
        <div
            ref={wrapRef}
            className={`interactive-cube relative border-0 outline-none ${className}`}
            onPointerEnter={() => setPointer((p) => ({ ...p, active: true }))}
            onPointerLeave={() => {
                setPointer({ x: 0, y: 0, active: false })
                dragging.current = false
            }}
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerUp={onUp}
            style={{
                cursor: dragging.current ? 'grabbing' : 'grab',
                touchAction: 'none'
            }}
        >
            {/* Glow halo */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        'radial-gradient(circle at 50% 50%, hsl(var(--neon-cyan) / 0.22), transparent 60%)',
                    filter: 'blur(20px)'
                }}
            />
            <Canvas
                flat
                orthographic
                dpr={[1.5, 2]}
                camera={{ position: [3, 2, 4], zoom: 110 }}
                gl={{ alpha: true, antialias: true }}
                style={{
                    background: 'transparent',
                    border: 0,
                    outline: 'none'
                }}
            >
                <Scene
                    spin={spin}
                    pointer={pointer}
                    flash={flash}
                    flashFace={flashFace}
                    labelData={labelData}
                />
            </Canvas>

            {/* Connector lines overlay (rendered above canvas, below labels) */}
            <ConnectorOverlay labelData={labelData} size={overlaySize} />
        </div>
    )
}

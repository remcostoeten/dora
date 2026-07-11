/* ---------------------------------------------------------------------------
 * Live container metrics — a scrolling CPU/IO sparkline in the spirit of
 * `docker stats`. A seamless waveform (its tail equals its head) is drawn
 * twice and translated left by one viewport width on a loop, so the graph
 * streams continuously. While a container boots the line drops flat and the
 * parent overlays a spinner.
 * ------------------------------------------------------------------------- */

const W = 60
const H = 22
const STEP = 6

// Deterministic so server and client render identically (no hydration drift).
function buildWave(seed: number) {
    const n = W / STEP
    const ys: number[] = []
    for (let i = 0; i <= n; i++) {
        const t = i / n
        const a = Math.sin(t * Math.PI * 2 + seed * 1.3)
        const b = Math.sin(t * Math.PI * 4 + seed * 2.1)
        const c = Math.sin(t * Math.PI * 6 + seed)
        const h = 11 + a * 4.5 + b * 2.2 + c * 1.2
        ys.push(Math.max(3, Math.min(19, h)))
    }
    ys[n] = ys[0] // seam continuity so the loop is invisible

    const pts: string[] = []
    for (let copy = 0; copy < 2; copy++) {
        for (let i = 0; i <= n; i++) {
            const x = i * STEP + copy * W
            const y = (H - ys[i]).toFixed(2)
            pts.push(`${x},${y}`)
        }
    }
    const line = `M ${pts.join(' L ')}`
    const area = `${line} L ${2 * W},${H} L 0,${H} Z`
    return { line, area }
}

export function ActivitySparkline({
    active,
    animate,
    color,
    phase
}: {
    active: boolean
    animate: boolean
    color: string
    phase: number
}) {
    const { line, area } = buildWave(phase + 1)
    const dur = `${3 + phase * 0.6}s`

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-7"
            aria-hidden="true"
        >
            {/* chart guides */}
            <line
                x1="0"
                y1={H - 0.5}
                x2={W}
                y2={H - 0.5}
                stroke="var(--color-line)"
                strokeWidth="0.5"
            />
            <line
                x1="0"
                y1={H / 2}
                x2={W}
                y2={H / 2}
                stroke="var(--color-surface-raised)"
                strokeWidth="0.5"
                strokeDasharray="1.5 2.5"
            />

            {active ? (
                <g>
                    <path d={area} fill={color} opacity={0.12} />
                    <path
                        d={line}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.1"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.95}
                    />
                    {animate ? (
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="0 0"
                            to={`-${W} 0`}
                            dur={dur}
                            repeatCount="indefinite"
                        />
                    ) : null}
                </g>
            ) : (
                // idle / booting — flat trace near the floor
                <line
                    x1="0"
                    y1={H - 4}
                    x2={W}
                    y2={H - 4}
                    stroke={color}
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    opacity={0.3}
                />
            )}
        </svg>
    )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

import { ACCENT_COLOR } from './constants'

export interface CommitDetail {
    sha: string
    message: string
    author: string
    authorAvatar?: string
    time: string
    additions?: number
    deletions?: number
    files?: string[]
}

export interface CommitDataPoint {
    date: string
    commits: number
    details?: CommitDetail[]
}

interface CommitGraphProps {
    data: CommitDataPoint[]
    hoveredIndex: number | null
    onHoverChange: (
        index: number | null,
        position?: { x: number; y: number }
    ) => void
    onClick: (index: number) => void
    accentColor?: string
}

export function CommitGraph({
    data,
    hoveredIndex,
    onHoverChange,
    onClick,
    accentColor = ACCENT_COLOR
}: CommitGraphProps) {
    const [animationProgress, setAnimationProgress] = useState(0)
    const [isInView, setIsInView] = useState(false)
    const [hasAnimated, setHasAnimated] = useState(false)
    const [zoom, setZoom] = useState(1) // 1 = default, higher = more zoomed in
    const [panOffset, setPanOffset] = useState(0) // horizontal scroll offset (0-1 range representing percentage)
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const animationRef = useRef<number | null>(null)
    const startTimeRef = useRef<number | null>(null)

    const maxCommits = Math.max(...data.map((d) => d.commits), 1)
    const animationDuration = 1900

    const minZoom = 1
    const maxZoom = 4

    // Calculate visible range based on zoom and pan
    const visibleRange = 1 / zoom
    const startIndex = Math.floor(panOffset * data.length)
    const endIndex = Math.min(
        Math.ceil((panOffset + visibleRange) * data.length),
        data.length
    )
    const visibleData = data.slice(startIndex, endIndex)

    const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3)
    }

    const clamp = (value: number, min = 0, max = 1): number => {
        return Math.max(min, Math.min(max, value))
    }

    const animate = useCallback(
        (timestamp: number) => {
            if (startTimeRef.current === null) {
                startTimeRef.current = timestamp
            }

            const elapsed = timestamp - startTimeRef.current
            const progress = Math.min(elapsed / animationDuration, 1)
            const easedProgress = easeOutCubic(progress)

            setAnimationProgress(easedProgress)

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate)
            } else {
                setHasAnimated(true)
            }
        },
        [animationDuration]
    )

    const startAnimation = useCallback(() => {
        if (hasAnimated) return
        setIsInView(true)

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setAnimationProgress(1)
            setHasAnimated(true)
            return
        }

        startTimeRef.current = null
        animationRef.current = requestAnimationFrame(animate)
    }, [animate, hasAnimated])

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    requestAnimationFrame(() => {
                        startAnimation()
                    })
                    observer.disconnect()
                }
            },
            {
                threshold: 0.1,
                rootMargin: '120px 0px'
            }
        )

        if (containerRef.current) {
            observer.observe(containerRef.current)
        }

        return () => {
            observer.disconnect()
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [startAnimation])

    // Handle scroll wheel for zooming
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault()

            // Shift + scroll = zoom, normal scroll = pan
            if (e.shiftKey || e.ctrlKey) {
                const delta = e.deltaY > 0 ? -0.2 : 0.2
                setZoom((prev) => {
                    const newZoom = Math.max(
                        minZoom,
                        Math.min(maxZoom, prev + delta)
                    )
                    // Adjust pan offset to keep the center point stable
                    if (newZoom !== prev) {
                        const centerPoint = panOffset + visibleRange / 2
                        const newVisibleRange = 1 / newZoom
                        setPanOffset(
                            Math.max(
                                0,
                                Math.min(
                                    1 - newVisibleRange,
                                    centerPoint - newVisibleRange / 2
                                )
                            )
                        )
                    }
                    return newZoom
                })
            } else {
                // Horizontal pan
                const delta = e.deltaY > 0 ? 0.05 : -0.05
                setPanOffset((prev) =>
                    Math.max(0, Math.min(1 - visibleRange, prev + delta))
                )
            }
        },
        [panOffset, visibleRange]
    )

    const handleMouseMove = (
        e: React.MouseEvent<HTMLDivElement>,
        relativeIndex: number
    ) => {
        const actualIndex = startIndex + relativeIndex
        const rect = e.currentTarget.getBoundingClientRect()
        const parentRect = containerRef.current?.getBoundingClientRect()
        if (parentRect && actualIndex < data.length) {
            onHoverChange(actualIndex, {
                x: rect.left - parentRect.left + rect.width / 2,
                y: e.clientY - parentRect.top
            })
        }
    }

    const handleClick = (relativeIndex: number) => {
        const actualIndex = startIndex + relativeIndex
        if (actualIndex < data.length) {
            onClick(actualIndex)
        }
    }

    const getGraphPoints = (heightMultiplier = 1) => {
        return visibleData.map((d, i) => ({
            x: i * 3 + 1.5,
            y:
                60 -
                (d.commits / maxCommits) *
                    45 *
                    heightMultiplier *
                    animationProgress
        }))
    }

    const generateSmoothPath = (heightMultiplier = 1) => {
        const width = visibleData.length * 3
        const points = getGraphPoints(heightMultiplier)

        if (animationProgress === 0) {
            return `M 0 60 L ${width} 60`
        }

        let path = `M ${points[0].x} ${points[0].y}`
        for (let i = 0; i < points.length - 1; i++) {
            const cp1x = points[i].x + 1
            const cp1y = points[i].y
            const cp2x = points[i + 1].x - 1
            const cp2y = points[i + 1].y
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`
        }
        return path
    }

    const generateSegmentPath = (index: number) => {
        const points = getGraphPoints()
        const current = points[index]
        const next = points[index + 1]

        if (!current || !next) return ''

        const cp1x = current.x + 1
        const cp2x = next.x - 1
        return `M ${current.x} ${current.y} C ${cp1x} ${current.y}, ${cp2x} ${next.y}, ${next.x} ${next.y}`
    }

    const staggerStrength = (index: number, total: number) => {
        if (hasAnimated) {
            return {
                reveal: 1,
                wave: 0
            }
        }

        const position = index / Math.max(total - 1, 1)
        const sweep = clamp((animationProgress - 0.1) / 0.78)
        const reveal = clamp((sweep - position + 0.08) / 0.12)
        const wave = clamp(1 - Math.abs(position - sweep) / 0.1)

        return {
            reveal,
            wave
        }
    }

    const pointOpacity = (index: number) => {
        const { reveal, wave } = staggerStrength(index, visibleData.length)

        return clamp(reveal * (0.28 + wave * 0.72))
    }

    // Find hovered index in visible range
    const hoveredVisibleIndex =
        hoveredIndex !== null ? hoveredIndex - startIndex : null
    const isHoveredVisible =
        hoveredVisibleIndex !== null &&
        hoveredVisibleIndex >= 0 &&
        hoveredVisibleIndex < visibleData.length

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 transition-[opacity,filter,transform] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{
                opacity: isInView ? 1 : 0,
                filter: isInView ? 'blur(0px)' : 'blur(8px)',
                transform: isInView ? 'translateY(0)' : 'translateY(14px)'
            }}
        >
            {/* Scrollable graph container */}
            <div
                ref={scrollContainerRef}
                className="absolute inset-0 opacity-25 group-hover:opacity-45 transition-opacity duration-700"
                onWheel={handleWheel}
                style={{ minHeight: '100%' }}
            >
                <svg
                    viewBox={`0 0 ${visibleData.length * 3} 60`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                    style={{ display: 'block' }}
                >
                    <defs>
                        <linearGradient
                            id="waveGradient"
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                        >
                            <stop
                                offset="0%"
                                stopColor={accentColor}
                                stopOpacity="0.4"
                            />
                            <stop
                                offset="100%"
                                stopColor={accentColor}
                                stopOpacity="0.02"
                            />
                        </linearGradient>
                        <linearGradient
                            id="lineGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                        >
                            <stop
                                offset="0%"
                                stopColor={accentColor}
                                stopOpacity="0.1"
                            />
                            <stop
                                offset="50%"
                                stopColor={accentColor}
                                stopOpacity="0.7"
                            />
                            <stop
                                offset="100%"
                                stopColor={accentColor}
                                stopOpacity="0.1"
                            />
                        </linearGradient>
                        <linearGradient
                            id="gridGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                        >
                            <stop
                                offset="0%"
                                stopColor={accentColor}
                                stopOpacity="0"
                            />
                            <stop
                                offset="50%"
                                stopColor={accentColor}
                                stopOpacity="0.18"
                            />
                            <stop
                                offset="100%"
                                stopColor={accentColor}
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {[15, 30, 45].map((y, index) => (
                        <line
                            key={y}
                            x1="0"
                            x2={visibleData.length * 3}
                            y1={y}
                            y2={y}
                            stroke="url(#gridGradient)"
                            strokeWidth="0.35"
                            style={{
                                opacity: Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        (animationProgress - index * 0.08) / 0.4
                                    )
                                ),
                                transform: `translateY(${(1 - animationProgress) * 4}px)`,
                                transformOrigin: 'center'
                            }}
                        />
                    ))}

                    <path
                        d={`${generateSmoothPath()} L ${visibleData.length * 3} 60 L 0 60 Z`}
                        fill="url(#waveGradient)"
                        style={{
                            opacity: Math.min(1, animationProgress * 1.4)
                        }}
                    />

                    <path
                        d={generateSmoothPath()}
                        fill="none"
                        stroke={accentColor}
                        strokeLinecap="round"
                        strokeWidth="2.4"
                        pathLength="1"
                        style={{
                            opacity: Math.min(
                                0.28,
                                Math.max(0, (animationProgress - 0.12) * 0.5)
                            ),
                            strokeDasharray: 1,
                            strokeDashoffset: 1 - animationProgress,
                            filter: `drop-shadow(0 0 10px ${accentColor}55)`
                        }}
                    />

                    <path
                        d={generateSmoothPath()}
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth="1"
                        strokeLinecap="round"
                        pathLength="1"
                        style={{
                            strokeDasharray: 1,
                            strokeDashoffset: 1 - animationProgress
                        }}
                    />

                    {visibleData.slice(0, -1).map((d, i) => {
                        const { reveal, wave } = staggerStrength(
                            i,
                            visibleData.length - 1
                        )

                        if (reveal <= 0) return null

                        return (
                            <path
                                key={`${d.date}-segment`}
                                d={generateSegmentPath(i)}
                                fill="none"
                                stroke={wave > 0.28 ? '#f5c0c0' : accentColor}
                                strokeLinecap="round"
                                strokeWidth={0.75 + wave * 1.7}
                                pathLength="1"
                                style={{
                                    opacity: reveal * (0.16 + wave * 0.74),
                                    strokeDasharray: 1,
                                    strokeDashoffset: 1 - reveal,
                                    filter:
                                        wave > 0.08
                                            ? `drop-shadow(0 0 ${4 + wave * 10}px ${
                                                  wave > 0.28
                                                      ? '#f5c0c0'
                                                      : accentColor
                                              })`
                                            : undefined
                                }}
                            />
                        )
                    })}

                    {visibleData.map((d, i) => {
                        const opacity = pointOpacity(i)
                        const { wave } = staggerStrength(i, visibleData.length)

                        if (opacity <= 0 || d.commits === 0) return null

                        return (
                            <circle
                                key={`${d.date}-point`}
                                cx={i * 3 + 1.5}
                                cy={
                                    60 -
                                    (d.commits / maxCommits) *
                                        45 *
                                        animationProgress
                                }
                                r={0.65 + wave * 1.35}
                                fill={wave > 0.35 ? '#f5c0c0' : accentColor}
                                style={{
                                    opacity,
                                    filter: `drop-shadow(0 0 ${3 + wave * 7}px ${
                                        wave > 0.35 ? '#f5c0c0' : accentColor
                                    })`
                                }}
                            />
                        )
                    })}

                    {isHoveredVisible && animationProgress > 0 && (
                        <circle
                            cx={hoveredVisibleIndex * 3 + 1.5}
                            cy={
                                60 -
                                (visibleData[hoveredVisibleIndex].commits /
                                    maxCommits) *
                                    45 *
                                    animationProgress
                            }
                            r="2.5"
                            fill={accentColor}
                            className="transition-all duration-150"
                        />
                    )}
                </svg>
            </div>

            {/* Interactive hover/click zones */}
            <div
                className="absolute inset-0 flex z-10"
                onMouseLeave={() => onHoverChange(null)}
                onWheel={handleWheel}
            >
                {visibleData.map((_, i) => (
                    <div
                        key={startIndex + i}
                        className="flex-1 h-full cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onMouseMove={(e) => handleMouseMove(e, i)}
                        onClick={() => handleClick(i)}
                    />
                ))}
            </div>

            {/* Hover line indicator */}
            {isHoveredVisible && (
                <div
                    className="absolute top-0 bottom-0 w-px pointer-events-none z-10 transition-opacity duration-200"
                    style={{
                        left: `${(hoveredVisibleIndex / visibleData.length) * 100}%`,
                        background: `linear-gradient(to bottom, transparent, ${accentColor}40, transparent)`
                    }}
                />
            )}

            {/* Zoom indicator */}
            {zoom > 1 && (
                <div className="absolute bottom-1 right-1 text-[9px] text-[#3a3a3a] pointer-events-none z-20 font-mono">
                    {zoom.toFixed(1)}x
                </div>
            )}

            {/* Scroll position indicator when zoomed */}
            {zoom > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a1a1a] pointer-events-none z-20">
                    <div
                        className="h-full transition-all duration-150"
                        style={{
                            width: `${visibleRange * 100}%`,
                            marginLeft: `${panOffset * 100}%`,
                            backgroundColor: `${accentColor}40`
                        }}
                    />
                </div>
            )}
        </div>
    )
}

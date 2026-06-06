'use client'

import {
    useRef,
    useState,
    useEffect,
    useLayoutEffect,
    type CSSProperties
} from 'react'
import {
    Tag,
    Calendar,
    GitCommit,
    Clock,
    Star,
    Download,
    Check,
    Copy
} from 'lucide-react'
import { CommitGraph, type CommitDetail } from './commit-graph'
import { GraphTooltip } from './graph-tooltip'
import { CommitDetailsModal } from './commit-details-modal'
import { CornerTick } from '@/components/corner-tick'
import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'
import { ACCENT_COLOR } from './constants'
import { ScrollMotionNumber } from '@/shared/components/motion-number'
import type { GitHubStatsData } from '@/core/github/get-github-stats'

// Strong ease-out — the built-in CSS easings lack punch. Used for the tab
// indicator slide and the label/command cross-fades so motion feels intentional.
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

function formatDownloads(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
    return num.toString()
}

function PlatformIcon({
    platform,
    className = 'w-3.5 h-3.5'
}: {
    platform: string
    className?: string
}) {
    switch (platform) {
        case 'brew':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M5.055 6.905c-.34-.789-.254-1.756.043-2.573.182-.528.467-1.025.8-1.456.17-.252.34-.504.426-.777.042-.168-.085-.462-.17-.672-.128-.294-.255-.588-.17-.84.042-.126.255-.336.51-.336.256 0 .469.084.596.21.17.168.256.42.341.672.085.378.042.798-.128 1.177-.213.504-.596.924-.98 1.26-.382.42-.765.84-1.02 1.344-.255.504-.34 1.092-.17 1.638.042.126.128.378.042.462-.085.084-.255.042-.383 0-.467-.126-.849-.42-1.063-.714-.043-.126-.085-.252-.085-.378.043-.127.043-.295-.043-.084l-.546-.933zm5.12 7.98c.212.504.638.882 1.106 1.134.638.336 1.361.504 2.041.336.681-.168 1.234-.63 1.489-1.26.128-.336.17-.714.128-1.092-.043-.504-.255-.966-.596-1.344-.298-.294-.68-.504-1.106-.63-.298-.084-.638-.084-.936-.042-.553.084-1.064.378-1.404.798-.298.336-.51.756-.596 1.218-.085.336-.127.588-.126.882zm10.453-7.98c.34-.789.255-1.756-.042-2.573-.183-.528-.468-1.025-.8-1.456-.17-.252-.34-.504-.426-.777-.043-.168.085-.462.17-.672.127-.294.255-.588.17-.84-.043-.126-.256-.336-.511-.336s-.469.084-.596.21c-.17.168-.255.42-.34.672-.085.378-.043.798.127 1.177.213.504.596.924.98 1.26.382.42.765.84 1.02 1.344.256.504.34 1.092.17 1.638-.042.126-.127.378-.042.462.085.084.255.042.383 0 .468-.126.85-.42 1.064-.714.042-.084.085-.168.085-.252-.043-.168 0-.336-.042-.546l.63-.63zM12 24c6.628 0 12-5.373 12-12S18.628 0 12 0 0 5.373 0 12s5.372 12 12 12z" />
                </svg>
            )
        case 'snap':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M13.69 13.287V5.667l5.237 2.312-5.237 5.308zM10.095 18.5L4.5 20.846l3.102-7.22h5.759l-3.266 4.874zm7.094-5.94l-3.502 3.467 3.502 7.227 5.093-3.467v-7.227h-5.093zM4.5 3l5.595 2.634v7.52L4.5 10.422V3zm9.19 0l5.632 2.634v4.58l-5.633-2.312V3z" />
                </svg>
            )
        case 'aur':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M12 2L2 19h4l2-3.5h8L18 19h4L12 2zm0 5l3 5H9l3-5z" />
                </svg>
            )
        case 'apt':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z" />
                </svg>
            )
        case 'winget':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
            )
        case 'github':
            return (
                <svg
                    viewBox="0 0 24 24"
                    className={className}
                    fill="currentColor"
                >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
            )
        default:
            return <Download className={className} />
    }
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="relative border border-[#3a3138] p-1.5 text-[#8a8a8a] transition-colors hover:border-[#e3b2b3]/45 hover:bg-[#e3b2b3]/5 hover:text-[#e3b2b3]"
            title="Copy command"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
                <Copy className="w-3.5 h-3.5" />
            )}
        </button>
    )
}

// Loops a set of words by rolling them vertically like a split-flap / slot
// reel (e.g. AUR ⇄ yay, since yay is the AUR helper used to install the
// package). A clipped one-line window shows a stacked column that slides up by
// one line per step — positional motion reads clearly even on a dim, tiny
// label, where an opacity crossfade is invisible. The in-flow sizer reserves
// the widest word's box so the tab never jiggles. Reduced motion drops the roll
// for a plain crossfade.
function CyclingLabel({
    words,
    hold = 2200
}: {
    words: string[]
    hold?: number
}) {
    const [index, setIndex] = useState(0)
    const reduced = usePrefersReducedMotion()

    useEffect(() => {
        const cycle = setInterval(() => {
            setIndex((c) => (c + 1) % words.length)
        }, hold)
        return () => clearInterval(cycle)
    }, [words.length, hold])

    const widest = words.reduce((a, b) => (b.length > a.length ? b : a), '')

    if (reduced) {
        return (
            <span className="relative inline-grid place-items-center">
                <span aria-hidden className="invisible col-start-1 row-start-1">
                    {widest}
                </span>
                <span
                    key={words[index]}
                    className="col-start-1 row-start-1 transition-opacity duration-200"
                >
                    {words[index]}
                </span>
            </span>
        )
    }

    return (
        <span className="relative inline-flex overflow-hidden align-bottom">
            {/* sizer fixes the one-line window's width + height */}
            <span aria-hidden className="invisible">
                {widest}
            </span>
            {/* stacked reel, slid up one line per step; subtle overshoot on settle */}
            <span
                aria-hidden
                className="absolute inset-x-0 top-0 flex flex-col"
                style={{
                    transform: `translateY(-${(index * 100) / words.length}%)`,
                    transition: `transform 360ms cubic-bezier(0.34, 1.3, 0.64, 1)`
                }}
            >
                {words.map((word) => (
                    <span key={word} className="block">
                        {word}
                    </span>
                ))}
            </span>
            {/* the live value, visually hidden, for a stable accessible name */}
            <span className="sr-only">{words[index]}</span>
        </span>
    )
}

// Fades the command string in with a brief blur whenever the active tab
// changes, so the text morphs in step with the sliding indicator instead of
// snapping. Mounts fresh on each switch via the parent's `key`. Reduced motion
// keeps the fade but drops the blur.
function CommandSwap({ children }: { children: React.ReactNode }) {
    const reduced = usePrefersReducedMotion()
    const [shown, setShown] = useState(false)

    useEffect(() => {
        setShown(true)
    }, [])

    return (
        <span
            className="block min-w-0 truncate transition-[opacity,filter]"
            style={{
                opacity: shown ? 1 : 0,
                filter: reduced || shown ? 'blur(0px)' : 'blur(3px)',
                transitionDuration: '240ms',
                transitionTimingFunction: EASE_OUT
            }}
        >
            {children}
        </span>
    )
}

// Tab indicator — the rose pill that tracks the active install tab. Position is
// driven by a GPU `transform: translate()` (only transform/opacity hit the
// compositor; animating left/top would thrash layout). Size still transitions,
// but the box has no children so it stays cheap. Reduced motion snaps instantly.
function TabIndicator({ activeRect }: { activeRect: DOMRect | null }) {
    const reduced = usePrefersReducedMotion()
    if (!activeRect) return null

    const move = `transform 300ms ${EASE_OUT}`
    const resize = `width 300ms ${EASE_OUT}, height 300ms ${EASE_OUT}`

    return (
        <div
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 border border-[#e3b2b3]/45 bg-[#e3b2b3]/5"
            style={{
                width: activeRect.width,
                height: activeRect.height,
                transform: `translate(${activeRect.left}px, ${activeRect.top}px)`,
                transition: reduced ? 'none' : `${move}, ${resize}`,
                zIndex: 0
            }}
        />
    )
}

export interface GitHubStatsProps {
    data: GitHubStatsData
    accentColor?: string
}

export function GitHubStats({
    data,
    accentColor = ACCENT_COLOR
}: GitHubStatsProps) {
    const reduced = usePrefersReducedMotion()
    const [contentVisible, setContentVisible] = useState(false)
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number
        y: number
    } | null>(null)
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(
        null
    )
    const [activeInstall, setActiveInstall] = useState<string>('brew')
    const [indicatorRect, setIndicatorRect] = useState<DOMRect | null>(null)
    const commitsContainerRef = useRef<HTMLDivElement>(null)
    const tabsContainerRef = useRef<HTMLDivElement>(null)
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
    const revealClass = reduced
        ? 'opacity-100'
        : contentVisible
          ? 'opacity-100'
          : 'opacity-0'
    function revealStyle(delay: number): CSSProperties {
        return {
            transitionDelay: reduced ? '0ms' : `${delay}ms`,
            transitionDuration: reduced ? '180ms' : '420ms',
            transitionProperty: 'opacity',
            transitionTimingFunction: EASE_OUT
        }
    }

    useEffect(() => {
        if (reduced) {
            setContentVisible(true)
            return
        }

        const id = requestAnimationFrame(() => setContentVisible(true))
        return () => cancelAnimationFrame(id)
    }, [reduced])

    // Update indicator position when active tab changes
    useLayoutEffect(() => {
        const activeTab = tabRefs.current.get(activeInstall)
        const container = tabsContainerRef.current
        if (activeTab && container) {
            const containerRect = container.getBoundingClientRect()
            const tabRect = activeTab.getBoundingClientRect()
            setIndicatorRect({
                left: tabRect.left - containerRect.left,
                top: tabRect.top - containerRect.top,
                width: tabRect.width,
                height: tabRect.height
            } as DOMRect)
        }
    }, [activeInstall, data])

    const handleHoverChange = (
        index: number | null,
        position?: { x: number; y: number }
    ) => {
        setHoveredIndex(index)
        setTooltipPosition(position ?? null)
    }

    const handleDayClick = (index: number) => {
        setSelectedDayIndex(index)
    }

    const handleCloseModal = () => {
        setSelectedDayIndex(null)
    }

    const {
        version,
        versionUrl,
        startedAt,
        latestCommitAt,
        latestCommitSha,
        totalCommits,
        stars,
        commitData,
        packages
    } = data
    const sourceUrl = 'https://github.com/remcostoeten/dora'

    const activePackage =
        packages.find((p) => p.platform === activeInstall) ?? packages[0]

    return (
        <>
            <div className="w-full bg-[#0a0a0a]">
                <div className="relative overflow-hidden border border-[#3a3138]">
                    <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
                    <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
                    {/* Top row: Info + Commits */}
                    <div className="flex flex-col sm:flex-row">
                        {/* Left info section: Version + Timeline — 1/3 width so
                            its divider lines up with the features grid's first
                            column border, leaving Commits ~2/3 */}
                        <div className="w-full flex-shrink-0 border-b border-[#1a1a1a] sm:w-1/3 sm:border-b-0 sm:border-r">
                            {/* Version */}
                            <a
                                href={versionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border-b border-[#1a1a1a] px-5 py-4 transition-colors hover:bg-[#0d0d0d]"
                            >
                                <div
                                    className={revealClass}
                                    style={revealStyle(0)}
                                >
                                    <div className="mb-1 flex items-center gap-2 font-pixel text-xs font-[500] uppercase tracking-[0] text-[#8a8a8a]">
                                        <Tag className="w-3 h-3" />
                                        Version
                                    </div>
                                    <div className="font-mono text-lg font-medium text-[#9a9a9a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                        {version}
                                    </div>
                                </div>
                            </a>

                            {/* Timeline */}
                            <div className="px-5 py-4">
                                <div
                                    className={revealClass}
                                    style={revealStyle(55)}
                                >
                                    <div className="flex items-center gap-4 text-[11px]">
                                        <div>
                                            <div className="mb-1 flex items-center gap-1.5 font-pixel font-[500] uppercase tracking-[0] text-[#8a8a8a]">
                                                <Calendar className="w-2.5 h-2.5" />
                                                Started
                                            </div>
                                            <div className="text-[#7a7a7a]">
                                                <ScrollMotionNumber value={startedAt} />
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-[#1a1a1a]" />
                                        <a
                                            href={
                                                latestCommitSha
                                                    ? `${sourceUrl}/commit/${latestCommitSha}`
                                                    : undefined
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="transition-colors hover:text-[#9a9a9a]"
                                        >
                                            <div className="mb-1 flex items-center gap-1.5 font-pixel font-[500] uppercase tracking-[0] text-[#8a8a8a]">
                                                <Clock className="w-2.5 h-2.5" />
                                                Latest
                                            </div>
                                            <div className="text-[#7a7a7a]">
                                                <ScrollMotionNumber value={latestCommitAt} />
                                            </div>
                                        </a>
                                    </div>
                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[#8a8a8a]">
                                        <Star className="w-2.5 h-2.5" />
                                        <span>
                                            {stars} star
                                            {stars !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Commits - with interactive graph */}
                        <div
                            ref={commitsContainerRef}
                            className="relative min-h-[150px] flex-1 overflow-visible px-5 py-4 group sm:min-h-[120px] sm:px-6"
                        >
                            <div
                                className={revealClass}
                                style={revealStyle(110)}
                            >
                                {commitData.length > 0 ? (
                                    <>
                                        <CommitGraph
                                            data={commitData}
                                            hoveredIndex={hoveredIndex}
                                            onHoverChange={handleHoverChange}
                                            onClick={handleDayClick}
                                            accentColor={accentColor}
                                        />

                                        <GraphTooltip
                                            data={
                                                hoveredIndex !== null
                                                    ? commitData[hoveredIndex]
                                                    : null
                                            }
                                            position={tooltipPosition}
                                            containerRef={commitsContainerRef}
                                            accentColor={accentColor}
                                        />
                                    </>
                                ) : null}

                                {/* Content - with pointer-events-none so hover/click passes through */}
                                <div className="relative z-20 pointer-events-none">
                                    <div className="mb-1 flex items-center gap-2 font-pixel text-xs font-[500] uppercase tracking-[0] text-[#8a8a8a]">
                                        <GitCommit className="w-3 h-3" />
                                        Commits
                                    </div>
                                    <div className="font-pixel text-2xl font-[500] tabular-nums text-[#9a9a9a]">
                                        <ScrollMotionNumber value={totalCommits} />
                                    </div>
                                    <div className="mt-1 hidden items-center gap-2 text-[10px] text-[#8a8a8a] sm:flex">
                                        <span>Scroll to pan</span>
                                        <span className="text-[#2a2a2a]">
                                            |
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <kbd className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1 py-0.5 font-mono text-[8px] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                                shift
                                            </kbd>
                                            scroll to zoom
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom row: Install section - full width */}
                    <div className="border-t border-[#1a1a1a] px-5 py-7 sm:px-6 sm:py-8">
                        <div className="mb-5 flex items-center gap-2 font-pixel text-xs font-[500] uppercase tracking-[0] text-[#8a8a8a]">
                            <div
                                className={`flex items-center gap-2 ${revealClass}`}
                                style={revealStyle(165)}
                            >
                                <Download className="w-3 h-3" />
                                Install
                            </div>
                        </div>

                        <div
                            className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 ${revealClass}`}
                            style={revealStyle(220)}
                        >
                            {/* Platform tabs with gooey indicator */}
                            <div
                                ref={tabsContainerRef}
                                className="relative -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 overflow-x-auto px-1 py-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:py-0"
                            >
                                <TabIndicator activeRect={indicatorRect} />
                                {packages.map((pkg) => (
                                    <button
                                        key={pkg.platform}
                                        ref={(el) => {
                                            if (el)
                                                tabRefs.current.set(
                                                    pkg.platform,
                                                    el
                                                )
                                        }}
                                        onClick={() =>
                                            setActiveInstall(pkg.platform)
                                        }
                                        className={`group/tab relative z-10 flex shrink-0 items-center gap-2 border border-transparent px-3 py-2 text-xs font-medium transition-[color,border-color,transform] duration-200 ease-out hover:border-[#e3b2b3]/25 motion-safe:active:scale-[0.97] ${
                                            activeInstall === pkg.platform
                                                ? 'border-[#e3b2b3]/45 text-[#e3b2b3]'
                                                : 'text-[#8a8a8a] hover:text-[#b0b0b0]'
                                        }`}
                                        title={pkg.name}
                                    >
                                        <CornerTick
                                            className={`-left-px -top-px -translate-x-1/2 -translate-y-1/2 transition-opacity ${
                                                activeInstall === pkg.platform
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover/tab:opacity-100'
                                            }`}
                                        />
                                        <CornerTick
                                            className={`-right-px -top-px translate-x-1/2 -translate-y-1/2 transition-opacity ${
                                                activeInstall === pkg.platform
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover/tab:opacity-100'
                                            }`}
                                        />
                                        <CornerTick
                                            className={`-bottom-px -left-px -translate-x-1/2 translate-y-1/2 transition-opacity ${
                                                activeInstall === pkg.platform
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover/tab:opacity-100'
                                            }`}
                                        />
                                        <CornerTick
                                            className={`-bottom-px -right-px translate-x-1/2 translate-y-1/2 transition-opacity ${
                                                activeInstall === pkg.platform
                                                    ? 'opacity-100'
                                                    : 'opacity-0 group-hover/tab:opacity-100'
                                            }`}
                                        />
                                        <PlatformIcon
                                            platform={pkg.platform}
                                            className="w-4 h-4"
                                        />
                                        {pkg.platform === 'aur' ? (
                                            <CyclingLabel
                                                words={['AUR', 'yay']}
                                            />
                                        ) : (
                                            <span>{pkg.name}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Command box */}
                            <div className="w-full flex-1 sm:max-w-xl">
                                {activePackage && (
                                    <a
                                        key={activePackage.platform}
                                        href={activePackage.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/cmd relative flex items-center gap-3 border border-[#3a3138] bg-[#0d0d0d] px-4 py-2.5 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-[#e3b2b3]/45 hover:bg-[#e3b2b3]/5 motion-safe:active:scale-[0.99]"
                                    >
                                        <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
                                        <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
                                        <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
                                        <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2 opacity-0 transition-opacity group-hover/cmd:opacity-100" />
                                        <code className="min-w-0 flex-1 font-mono text-sm text-[#6a6a6a] transition-colors group-hover/cmd:text-[#8a8a8a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                            <CommandSwap>
                                                {activePackage.command ||
                                                    `Download from ${activePackage.name}`}
                                            </CommandSwap>
                                        </code>
                                        {activePackage.command && (
                                            <CopyButton
                                                text={activePackage.command}
                                            />
                                        )}
                                    </a>
                                )}
                            </div>

                            {/* Downloads indicator */}
                            {activePackage?.downloads !== undefined &&
                                activePackage.downloads > 0 && (
                                    <span className="text-[10px] text-[#8a8a8a] whitespace-nowrap">
                                        {formatDownloads(
                                            activePackage.downloads
                                        )}{' '}
                                        downloads
                                    </span>
                                )}
                        </div>
                    </div>
                </div>
            </div>

            <CommitDetailsModal
                isOpen={selectedDayIndex !== null}
                onClose={handleCloseModal}
                data={
                    selectedDayIndex !== null && commitData.length > 0
                        ? commitData[selectedDayIndex]
                        : null
                }
                accentColor={accentColor}
                repoUrl={sourceUrl}
            />
        </>
    )
}

export { type CommitDataPoint, type CommitDetail } from './commit-graph'

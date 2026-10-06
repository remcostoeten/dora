'use client'

import {
    ArrowRight,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Map,
    Menu,
    Sparkles,
    X
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useShortcut } from '@remcostoeten/use-shortcut/react'
import type { ComponentType } from 'react'
import { useEffect, useRef, useState } from 'react'

import { CornerTick } from '@/components/corner-tick'
import { getFeaturePath, getNavFeatures } from '@/core/config/features'

/**
 * Marketing top bar — recreated from the hex.tech-style Figma design.
 * A centered primary nav that collapses into a full-screen menu on small
 * screens.
 */

const APP_PATH = '/app'

type TMenuLink = {
    label: string
    description: string
    href: string
    icon: ComponentType<{ className?: string }>
}

type TNavItem = {
    label: string
    href: string
    chevron?: boolean
    icon: ComponentType<{ className?: string }>
    menu?: TMenuLink[]
}

const FEATURES_MENU: TMenuLink[] = getNavFeatures().map(function (feature) {
    return {
        label: feature.menuLabel,
        description: feature.menuDescription,
        href: getFeaturePath(feature.slug),
        icon: feature.icon
    }
})

const NAV_LEFT: TNavItem[] = [
    {
        label: 'Features',
        href: '/features',
        chevron: true,
        icon: Sparkles,
        menu: FEATURES_MENU
    },
    { label: 'Changelog', href: '/changelog', icon: Map }
]

const NAV_RIGHT: TNavItem[] = [
    {
        label: 'Documentation',
        href: '/docs',
        icon: BookOpen
    }
]

const ALL_NAV_ITEMS = [...NAV_LEFT, ...NAV_RIGHT]

/**
 * Tracks whether the page has scrolled past a small threshold. Drives the
 * header's translucent-blur state — opaque at the top, frosted once content
 * starts sliding underneath it.
 */
function useScrolled(threshold = 8) {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > threshold)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [threshold])

    return scrolled
}

function NavLink({
    href,
    className,
    onClick,
    onFocus,
    onMouseEnter,
    children
}: {
    href: string
    className?: string
    onClick?: () => void
    onFocus?: () => void
    onMouseEnter?: () => void
    children: React.ReactNode
}) {
    if (href.startsWith('http')) {
        return (
            <a
                className={className}
                href={href}
                onClick={onClick}
                onFocus={onFocus}
                onMouseEnter={onMouseEnter}
                rel="noreferrer"
                target="_blank"
            >
                {children}
            </a>
        )
    }
    return (
        <Link
            className={className}
            href={href as Route}
            onClick={onClick}
            onFocus={onFocus}
            onMouseEnter={onMouseEnter}
        >
            {children}
        </Link>
    )
}

function NavItem({ label, href, chevron }: TNavItem) {
    return (
        <NavLink
            className="group inline-flex items-center gap-1 rounded-[1px] px-[13px] py-[9px] text-[14px] leading-none text-white/90 transition-colors hover:text-brand-200"
            href={href}
        >
            {label}
            {chevron ? (
                <ChevronDown
                    aria-hidden
                    className="h-3.5 w-3.5 text-white/40 transition-colors group-hover:text-brand-200"
                />
            ) : null}
        </NavLink>
    )
}

const DROPDOWN_COLUMNS = 2

function NavDropdown({ item }: { item: TNavItem }) {
    const menu = item.menu ?? []
    const rows = Math.ceil(menu.length / DROPDOWN_COLUMNS)
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState<number | null>(null)
    const [instant, setInstant] = useState(true)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    function cancelClose() {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
        }
    }

    function show() {
        cancelClose()
        setOpen(true)
    }

    function hide() {
        cancelClose()
        setOpen(false)
        setActive(null)
        setInstant(true)
    }

    function scheduleClose() {
        cancelClose()
        // grace period so crossing the trigger to panel gap does not flicker
        closeTimer.current = setTimeout(hide, 120)
    }

    function activate(index: number) {
        setInstant(active === null)
        setActive(index)
    }

    useEffect(() => cancelClose, [])

    const activeColumn = (active ?? 0) % DROPDOWN_COLUMNS
    const activeRow = Math.floor((active ?? 0) / DROPDOWN_COLUMNS)

    return (
        <div
            className="relative"
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                    hide()
            }}
            onFocus={show}
            onKeyDown={(event) => {
                if (event.key === 'Escape') hide()
            }}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
        >
            <NavLink
                className={`group inline-flex items-center gap-1 rounded-[1px] px-[13px] py-[9px] text-[14px] leading-none transition-colors hover:text-brand-200 ${
                    open ? 'text-brand-200' : 'text-white/90'
                }`}
                href={item.href}
                onClick={hide}
            >
                {item.label}
                <ChevronDown
                    aria-hidden
                    className={`h-3.5 w-3.5 transition-[transform,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:text-brand-200 ${
                        open ? 'rotate-180 text-brand-200' : 'text-white/40'
                    }`}
                />
            </NavLink>

            <div
                className="absolute left-0 top-full z-50 pt-3"
                inert={!open}
                style={{ pointerEvents: open ? 'auto' : 'none' }}
            >
                <div
                    className="nav-dropdown relative w-[min(560px,calc(100vw-48px))] border border-line-strong bg-surface-deep shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-20px_rgba(0,0,0,0.9),0_8px_20px_-12px_rgba(0,0,0,0.6)]"
                    data-open={open}
                >
                    <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
                    <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />

                    <div
                        className="relative grid p-1.5"
                        onMouseLeave={() => setActive(null)}
                        style={{
                            gridTemplateColumns: `repeat(${DROPDOWN_COLUMNS}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                        }}
                    >
                        <span
                            aria-hidden
                            className="nav-dropdown-highlight pointer-events-none absolute left-1.5 top-1.5 border border-brand-200/15 bg-brand-200/[0.06]"
                            data-active={active !== null}
                            data-instant={instant}
                            style={{
                                width: `calc((100% - 12px) / ${DROPDOWN_COLUMNS})`,
                                height: `calc((100% - 12px) / ${rows})`,
                                transform: `translate(${activeColumn * 100}%, ${activeRow * 100}%)`
                            }}
                        />
                        {menu.map((link, index) => {
                            const Icon = link.icon
                            const isActive = active === index
                            return (
                                <NavLink
                                    key={link.label}
                                    className="relative flex items-start gap-3 px-3 py-3 outline-none"
                                    href={link.href}
                                    onClick={hide}
                                    onFocus={() => activate(index)}
                                    onMouseEnter={() => activate(index)}
                                >
                                    <span
                                        className={`mt-px flex size-8 shrink-0 items-center justify-center border transition-colors duration-150 ${
                                            isActive
                                                ? 'border-brand-200/40 bg-surface-elevated text-brand-200'
                                                : 'border-line bg-surface text-brand-300'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <span
                                            className={`text-[13px] leading-none transition-colors duration-150 ${
                                                isActive
                                                    ? 'text-brand-200'
                                                    : 'text-white/90'
                                            }`}
                                        >
                                            {link.label}
                                        </span>
                                        <span className="text-[11px] leading-snug text-white/45">
                                            {link.description}
                                        </span>
                                    </span>
                                </NavLink>
                            )
                        })}
                    </div>

                    <div className="flex items-center justify-end border-t border-line px-4 py-2.5">
                        <NavLink
                            className="group/all inline-flex items-center gap-1.5 text-[12px] text-white/70 transition-colors hover:text-brand-200"
                            href={item.href}
                            onClick={hide}
                        >
                            All features
                            <ArrowRight
                                aria-hidden
                                className="h-3 w-3 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/all:translate-x-0.5"
                            />
                        </NavLink>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Logo() {
    return (
        <Link
            aria-label="Dora home"
            className="select-none px-2 [font-family:system-ui,sans-serif] text-[20px] font-semibold tracking-[0.08em] text-brand-200 [text-shadow:0_0_14px_color-mix(in srgb, var(--color-brand-200) 45%, transparent)]"
            href="/"
        >
            DORA
        </Link>
    )
}

function ViewAppButton({ className = '' }: { className?: string }) {
    // Open rings centered on each corner, faint by default and brighter on hover.
    const ring =
        'pointer-events-none absolute size-[17px] rounded-full border border-brand-200/30 transition-colors group-hover:border-brand-200/60'
    return (
        <Link
            className={`group relative inline-flex h-[38px] items-center justify-center overflow-visible border border-brand-200 bg-background px-4 text-[14px] leading-none text-brand-200 transition-colors hover:bg-brand-200/6 ${className}`}
            href={APP_PATH}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-px opacity-20 bg-[linear-gradient(35deg,color-mix(in srgb, var(--color-brand-200) 85%, transparent),color-mix(in srgb, var(--color-brand-600) 50%, transparent))]"
            />
            <span className="relative z-[1]">View web app</span>
            <span
                aria-hidden
                className={`${ring} -left-[8.5px] -top-[8.5px]`}
            />
            <span
                aria-hidden
                className={`${ring} -right-[8.5px] -top-[8.5px]`}
            />
            <span
                aria-hidden
                className={`${ring} -bottom-[8.5px] -left-[8.5px]`}
            />
            <span
                aria-hidden
                className={`${ring} -bottom-[8.5px] -right-[8.5px]`}
            />
        </Link>
    )
}

function MobileMenuRow({
    item,
    onNavigate
}: {
    item: TNavItem
    onNavigate: () => void
}) {
    const Icon = item.icon
    return (
        <NavLink
            className="group flex items-center gap-4 border-b border-line py-5 text-left"
            href={item.href}
            onClick={onNavigate}
        >
            <Icon className="h-5 w-5 shrink-0 text-brand-300" />
            <span className="flex-1 text-[17px] text-white/90 transition-colors group-hover:text-brand-200">
                {item.label}
            </span>
            <ChevronRight
                aria-hidden
                className="h-5 w-5 shrink-0 text-white/40 transition-colors group-hover:text-brand-200"
            />
        </NavLink>
    )
}

function MobileMenu({
    onClose,
    visible,
    onExited
}: {
    onClose: () => void
    visible: boolean
    onExited: () => void
}) {
    return (
        <div
            className="overlay-sheet fixed inset-0 z-[60] flex flex-col bg-background md:hidden"
            data-visible={visible}
            onTransitionEnd={(event) => {
                if (
                    !visible &&
                    event.propertyName === 'opacity' &&
                    event.target === event.currentTarget
                ) {
                    onExited()
                }
            }}
        >
            {/* Top frame: logo + circular close button, with rose corner brackets */}
            <div className="relative m-3 flex items-center justify-between border border-line-strong px-4 py-5">
                <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
                <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
                <Logo />
                <button
                    aria-label="Close menu"
                    className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong text-white/80 transition-colors hover:border-brand-200 hover:text-brand-200"
                    onClick={onClose}
                    type="button"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6 pb-8">
                {ALL_NAV_ITEMS.map((item) => (
                    <MobileMenuRow
                        item={item}
                        key={item.label}
                        onNavigate={onClose}
                    />
                ))}
                <ViewAppButton className="mt-8 h-[48px] w-full text-[16px]" />
            </nav>
        </div>
    )
}

export function DoraHeader() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuMounted, setMenuMounted] = useState(false)
    const [menuVisible, setMenuVisible] = useState(false)
    const scrolled = useScrolled()
    const $ = useShortcut()

    function renderNavItem(item: TNavItem) {
        return item.menu ? (
            <NavDropdown key={item.label} item={item} />
        ) : (
            <NavItem key={item.label} {...item} />
        )
    }

    useEffect(() => {
        const shortcut = $.bind('escape').on(() => setMenuOpen(false), {
            description: 'Close mobile menu',
            disabled: !menuOpen
        })
        return () => shortcut.unbind()
    }, [$, menuOpen])

    useEffect(() => {
        if (!menuOpen) {
            setMenuVisible(false)
            return
        }
        setMenuMounted(true)
        const frame = requestAnimationFrame(() => setMenuVisible(true))
        return () => cancelAnimationFrame(frame)
    }, [menuOpen])

    useEffect(() => {
        if (!menuMounted) {
            return
        }
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [menuMounted])

    return (
        <header className="sticky top-0 z-50 w-full bg-background px-3 pt-3">
            {/* Sidebar border lines that align with the marketing-container edges */}
            <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-line-strong"
                style={{ left: 'max(16px, calc(50% - 550px))' }}
            />
            <span
                aria-hidden
                className="pointer-events-none absolute bottom-0 top-0 w-px bg-line-strong"
                style={{ right: 'max(16px, calc(50% - 550px))' }}
            />
            <div
                aria-hidden
                className="h-px w-full bg-[linear-gradient(90deg,transparent,color-mix(in srgb, var(--color-brand-300) 40%, transparent),transparent)]"
            />
            <nav
                className={`relative backdrop-blur-xl transition-colors duration-300 ${
                    scrolled ? 'bg-background/55' : 'bg-background'
                }`}
                style={{
                    // lift the bar above the content once it detaches from the top
                    boxShadow: scrolled
                        ? '0 14px 44px -20px rgba(0,0,0,0.7)'
                        : '0 0 0 0 rgba(0,0,0,0)',
                    transition: 'box-shadow 320ms ease'
                }}
            >
                {/* hairline glow that fades in once the header detaches from the top */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in srgb, var(--color-brand-300) 40%, transparent),transparent)] transition-opacity duration-300"
                    style={{ opacity: scrolled ? 1 : 0 }}
                />
                <div
                    className="marketing-container relative flex items-center px-4"
                    style={{
                        height: scrolled ? 54 : 62,
                        transition: 'height 420ms cubic-bezier(0.32,0.72,0,1)'
                    }}
                >
                    {/* Frame borders */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 h-px w-full bg-line-strong"
                    />
                    <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 top-0 h-full w-px bg-line-strong"
                    />
                    <span
                        aria-hidden
                        className="pointer-events-none absolute right-0 top-0 h-full w-px bg-line-strong"
                    />

                    <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                    <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
                    <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />

                    {/* Mobile: logo + hamburger */}
                    <div className="flex w-full items-center justify-between md:hidden">
                        <Logo />
                        <button
                            aria-expanded={menuOpen}
                            aria-label="Open menu"
                            className="inline-flex size-9 items-center justify-center text-white/90 transition-colors hover:text-brand-200"
                            onClick={() => setMenuOpen(true)}
                            type="button"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Desktop: centered cluster */}
                    <div className="hidden w-full items-center justify-center gap-6 md:flex">
                        {NAV_LEFT.map(renderNavItem)}
                        <span
                            className="inline-block origin-center"
                            style={{
                                transform: scrolled
                                    ? 'scale(0.92)'
                                    : 'scale(1)',
                                transition:
                                    'transform 420ms cubic-bezier(0.32,0.72,0,1)'
                            }}
                        >
                            <Logo />
                        </span>
                        {NAV_RIGHT.map(renderNavItem)}
                        <ViewAppButton className="ml-1" />
                    </div>
                </div>
            </nav>

            {menuMounted ? (
                <MobileMenu
                    onClose={() => setMenuOpen(false)}
                    onExited={() => setMenuMounted(false)}
                    visible={menuVisible}
                />
            ) : null}
        </header>
    )
}

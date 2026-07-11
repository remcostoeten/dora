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
import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'

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
    children
}: {
    href: string
    className?: string
    onClick?: () => void
    children: React.ReactNode
}) {
    if (href.startsWith('http')) {
        return (
            <a
                className={className}
                href={href}
                onClick={onClick}
                rel="noreferrer"
                target="_blank"
            >
                {children}
            </a>
        )
    }
    return (
        <Link className={className} href={href as Route} onClick={onClick}>
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

/**
 * Desktop nav item with an animated dropdown panel. Opens on hover/focus,
 * scales in from the trigger (origin-aware, ease-out ~200ms) and staggers its
 * rows. Exit is faster than enter. Honors prefers-reduced-motion by dropping
 * the transform offsets and keeping only a quick fade.
 */
function NavDropdown({ item, reduced }: { item: TNavItem; reduced: boolean }) {
    const menu = item.menu ?? []
    const [open, setOpen] = useState(false)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    function cancelClose() {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current)
            closeTimer.current = null
        }
    }

    function scheduleClose() {
        cancelClose()
        // small grace period so crossing the trigger→panel gap doesn't flicker
        closeTimer.current = setTimeout(() => setOpen(false), 120)
    }

    useEffect(() => cancelClose, [])

    const panelClosedTransform = reduced
        ? 'none'
        : 'translateY(-6px) scale(0.96)'
    const rowClosedTransform = reduced ? 'none' : 'translateY(4px)'
    const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'

    return (
        <div
            className="relative"
            onFocus={() => {
                cancelClose()
                setOpen(true)
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                    scheduleClose()
            }}
            onMouseEnter={() => {
                cancelClose()
                setOpen(true)
            }}
            onMouseLeave={scheduleClose}
            onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
            }}
        >
            <NavLink
                className={`group inline-flex items-center gap-1 rounded-[1px] px-[13px] py-[9px] text-[14px] leading-none transition-colors hover:text-brand-200 ${
                    open ? 'text-brand-200' : 'text-white/90'
                }`}
                href={item.href}
                onClick={() => setOpen(false)}
            >
                {item.label}
                <ChevronDown
                    aria-hidden
                    className={`h-3.5 w-3.5 transition-[transform,color] duration-200 group-hover:text-brand-200 ${
                        open ? 'text-brand-200' : 'text-white/40'
                    }`}
                    style={{
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                />
            </NavLink>

            {/* pt-3 is the invisible bridge between trigger and panel */}
            <div
                className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3"
                style={{ pointerEvents: open ? 'auto' : 'none' }}
            >
                <div
                    className="relative w-[340px] overflow-hidden border border-line bg-surface-deep/90 p-1.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl"
                    style={{
                        transformOrigin: 'top center',
                        opacity: open ? 1 : 0,
                        transform: open
                            ? 'translateY(0) scale(1)'
                            : panelClosedTransform,
                        transition: open
                            ? `opacity 200ms ${ease}, transform 200ms ${ease}`
                            : 'opacity 140ms ease-out, transform 140ms ease-out'
                    }}
                >
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-brand-200/17"
                    />
                    {menu.map((link, index) => {
                        const Icon = link.icon
                        return (
                            <NavLink
                                key={link.label}
                                className="group/item flex items-start gap-3 rounded-[2px] px-3 py-2.5 transition-colors hover:bg-brand-200/6"
                                href={link.href}
                                onClick={() => setOpen(false)}
                            >
                                <span
                                    className="mt-px flex size-8 shrink-0 items-center justify-center border border-line bg-surface text-brand-300 transition-colors group-hover/item:border-brand-200/40 group-hover/item:text-brand-200"
                                    style={{
                                        opacity: open ? 1 : 0,
                                        transform: open
                                            ? 'translateY(0)'
                                            : rowClosedTransform,
                                        transition:
                                            'opacity 220ms ease-out, transform 220ms ease-out',
                                        transitionDelay: open
                                            ? `${60 + index * 35}ms`
                                            : '0ms'
                                    }}
                                >
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span
                                    className="flex min-w-0 flex-1 flex-col gap-1"
                                    style={{
                                        opacity: open ? 1 : 0,
                                        transform: open
                                            ? 'translateY(0)'
                                            : rowClosedTransform,
                                        transition:
                                            'opacity 220ms ease-out, transform 220ms ease-out',
                                        transitionDelay: open
                                            ? `${60 + index * 35}ms`
                                            : '0ms'
                                    }}
                                >
                                    <span className="flex items-center gap-1.5 text-[13px] leading-none text-white/90 transition-colors group-hover/item:text-brand-200">
                                        {link.label}
                                        <ArrowRight
                                            aria-hidden
                                            className="h-3 w-3 shrink-0 text-brand-200 opacity-0 transition-[opacity,transform] duration-200 group-hover/item:translate-x-0.5 group-hover/item:opacity-100"
                                        />
                                    </span>
                                    <span className="text-[11px] leading-snug text-white/40">
                                        {link.description}
                                    </span>
                                </span>
                            </NavLink>
                        )
                    })}
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

function MobileMenu({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background animate-in fade-in-0 duration-200 md:hidden">
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
    const scrolled = useScrolled()
    const reduced = usePrefersReducedMotion()
    const $ = useShortcut()

    function renderNavItem(item: TNavItem) {
        return item.menu ? (
            <NavDropdown key={item.label} item={item} reduced={reduced} />
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
            return
        }
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previous
        }
    }, [menuOpen])

    return (
        <header
            className="sticky top-0 z-50 w-full bg-background px-3 pt-3"
        >
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
                        transition: reduced
                            ? 'none'
                            : 'height 420ms cubic-bezier(0.32,0.72,0,1)'
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
                                transform:
                                    scrolled && !reduced
                                        ? 'scale(0.92)'
                                        : 'scale(1)',
                                transition: reduced
                                    ? 'none'
                                    : 'transform 420ms cubic-bezier(0.32,0.72,0,1)'
                            }}
                        >
                            <Logo />
                        </span>
                        {NAV_RIGHT.map(renderNavItem)}
                        <ViewAppButton className="ml-1" />
                    </div>
                </div>
            </nav>

            {menuOpen ? (
                <MobileMenu onClose={() => setMenuOpen(false)} />
            ) : null}
        </header>
    )
}

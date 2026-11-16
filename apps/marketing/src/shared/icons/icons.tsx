import type { ComponentType } from 'react'
import { Glyph, type IconProps, Part } from './glyph'

export function SearchIcon({ className }: IconProps) {
    return (
        <Glyph name="search" className={className}>
            <Part icon="search" part="lens">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.34-4.34" />
            </Part>
        </Glyph>
    )
}

export function BookIcon({ className }: IconProps) {
    return (
        <Glyph name="book" className={className}>
            <Part icon="book" part="left">
                <path d="M12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4a5 5 0 0 1 4 2" />
            </Part>
            <Part icon="book" part="right">
                <path d="M12 5a5 5 0 0 1 4-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4a5 5 0 0 0-4 2" />
            </Part>
            <path d="M12 5v16" />
        </Glyph>
    )
}

export function FolderIcon({ className }: IconProps) {
    return (
        <Glyph name="folder" className={className}>
            <Part icon="folder" part="folder">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </Part>
        </Glyph>
    )
}

export function ChevronIcon({ className }: IconProps) {
    return (
        <Glyph name="chevron" className={className}>
            <path d="m6 9 6 6 6-6" />
        </Glyph>
    )
}

export function HouseIcon({ className }: IconProps) {
    return (
        <Glyph name="house" className={className}>
            <Part icon="house" part="house">
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            </Part>
        </Glyph>
    )
}

export function DownloadIcon({ className }: IconProps) {
    return (
        <Glyph name="download" className={className}>
            <Part icon="download" part="arrow">
                <path d="M12 15V3" />
                <path d="m7 10 5 5 5-5" />
            </Part>
            <Part icon="download" part="tray">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            </Part>
        </Glyph>
    )
}

export function RocketIcon({ className }: IconProps) {
    return (
        <Glyph name="rocket" className={className}>
            <Part icon="rocket" part="ship">
                <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </Part>
            <Part icon="rocket" part="flame">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
            </Part>
        </Glyph>
    )
}

export function PageIcon({ className }: IconProps) {
    return (
        <Glyph name="page" className={className}>
            <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
            <path d="M14 2v5a1 1 0 0 0 1 1h5" />
            <Part icon="page" part="l1">
                <path d="M10 9H8" />
            </Part>
            <Part icon="page" part="l2">
                <path d="M16 13H8" />
            </Part>
            <Part icon="page" part="l3">
                <path d="M16 17H8" />
            </Part>
        </Glyph>
    )
}

export function BulbIcon({ className }: IconProps) {
    return (
        <Glyph name="bulb" className={className}>
            <Part icon="bulb" part="glass">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                <path d="M9 18h6" />
            </Part>
            <path d="M10 22h4" />
        </Glyph>
    )
}

export function SparkleIcon({ className }: IconProps) {
    return (
        <Glyph name="sparkle" className={className}>
            <path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z" />
            <path d="M19 16v4M17 18h4" />
        </Glyph>
    )
}

export function CompassIcon({ className }: IconProps) {
    return (
        <Glyph name="compass" className={className}>
            <circle cx="12" cy="12" r="10" />
            <Part icon="compass" part="needle">
                <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
            </Part>
        </Glyph>
    )
}

export function CloudIcon({ className }: IconProps) {
    return (
        <Glyph name="cloud" className={className}>
            <Part icon="cloud" part="cloud">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </Part>
        </Glyph>
    )
}

export function RouteIcon({ className }: IconProps) {
    return (
        <Glyph name="route" className={className}>
            <Part icon="route" part="start">
                <circle cx="6" cy="19" r="3" />
            </Part>
            <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
            <Part icon="route" part="end">
                <circle cx="18" cy="5" r="3" />
            </Part>
        </Glyph>
    )
}

export function PaletteIcon({ className }: IconProps) {
    return (
        <Glyph name="palette" className={className}>
            <Part icon="palette" part="palette">
                <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            </Part>
        </Glyph>
    )
}

export function MenuIcon({ className }: IconProps) {
    return (
        <Glyph name="menu" className={className}>
            <Part icon="menu" part="m1">
                <path d="M4 5h16" />
            </Part>
            <Part icon="menu" part="m2">
                <path d="M4 12h16" />
            </Part>
            <Part icon="menu" part="m3">
                <path d="M4 19h16" />
            </Part>
        </Glyph>
    )
}

export function CloseIcon({ className }: IconProps) {
    return (
        <Glyph name="close" className={className}>
            <Part icon="close" part="cross">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
            </Part>
        </Glyph>
    )
}

export function SunIcon({ className }: IconProps) {
    return (
        <Glyph name="sun" className={className}>
            <Part icon="sun" part="core">
                <circle cx="12" cy="12" r="4" />
            </Part>
            <Part icon="sun" part="rays">
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
            </Part>
        </Glyph>
    )
}

export function MoonIcon({ className }: IconProps) {
    return (
        <Glyph name="moon" className={className}>
            <Part icon="moon" part="moon">
                <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
            </Part>
        </Glyph>
    )
}

export function CopyIcon({ className }: IconProps) {
    return (
        <Glyph name="copy" className={className}>
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </Glyph>
    )
}

export function CheckIcon({ className }: IconProps) {
    return (
        <Glyph name="check" className={className}>
            <path d="M20 6 9 17l-5-5" />
        </Glyph>
    )
}

export function GithubIcon({ className }: IconProps) {
    return (
        <Glyph name="github" className={className}>
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
        </Glyph>
    )
}

export function XIcon({ className }: IconProps) {
    return (
        <Glyph name="x" className={className}>
            <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
            <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
        </Glyph>
    )
}

export function MailIcon({ className }: IconProps) {
    return (
        <Glyph name="mail" className={className}>
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </Glyph>
    )
}

/**
 * @name namedIcons
 * @description Icons by name, used to resolve the `icon` field in MDX
 * frontmatter and `meta.json`. Names follow Lucide so content stays portable.
 *
 * @example
 * const Icon = namedIcons.Rocket
 */
export const namedIcons = {
    BookOpen: BookIcon,
    Cloud: CloudIcon,
    Compass: CompassIcon,
    Download: DownloadIcon,
    FileText: PageIcon,
    Folder: FolderIcon,
    GitHub: GithubIcon,
    House: HouseIcon,
    Lightbulb: BulbIcon,
    Mail: MailIcon,
    Palette: PaletteIcon,
    Rocket: RocketIcon,
    Route: RouteIcon,
    Search: SearchIcon,
    X: XIcon
} satisfies Record<string, ComponentType<IconProps>>

export type IconName = keyof typeof namedIcons

/**
 * @name isIconName
 * @description True when the name has a matching icon.
 *
 * @example
 * if (isIconName(name)) createElement(namedIcons[name])
 */
export function isIconName(name: string): name is IconName {
    return Object.hasOwn(namedIcons, name)
}

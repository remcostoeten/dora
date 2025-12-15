'use client'

import { MonitorIcon, MoonStarIcon, SunIcon } from 'lucide-react'
import { motion } from 'motion/react'
import type { JSX } from 'react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/core/utilities/cn'
import { useTheme } from '@/core/state'

type Props = 'system' | 'light' | 'dark'

function ThemeOption({
    icon,
    value,
    isActive,
    onClick,
}: {
    icon: JSX.Element
    value: Props
    isActive?: boolean
    onClick: (value: Props) => void
}) {
    return (
        <button
            className={cn(
                'relative flex size-8 cursor-default items-center justify-center rounded-full transition-[color] [&_svg]:size-4',
                isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
            )}
            role="radio"
            aria-checked={isActive}
            aria-label={`Switch to ${value} theme`}
            onClick={() => onClick(value)}
        >
            {icon}

            {isActive && (
                <motion.div
                    layoutId="theme-option"
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                    className="absolute inset-0 rounded-full border border-border"
                />
            )}
        </button>
    )
}

const THEME_OPTIONS: { icon: JSX.Element; value: Props }[] = [
    {
        icon: <MonitorIcon />,
        value: 'system',
    },
    {
        icon: <SunIcon />,
        value: 'light',
    },
    {
        icon: <MoonStarIcon />,
        value: 'dark',
    },
]

export function ThemeSwitcher() {
    const { theme, setTheme } = useTheme()

    const isMounted = useSyncExternalStore(
        () => () => { },
        () => true,
        () => false
    )

    if (!isMounted) {
        return <div className="flex h-8 w-24" />
    }

    function handleThemeChange(value: Props) {
        if (value === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            setTheme(prefersDark ? 'dark' : 'light')
        } else {
            setTheme(value)
        }
    }

    // Map the actual theme to display value (system is special - shows based on current)
    const getActiveValue = (): Props => {
        // For now, just show light/dark as active since we don't track "system" preference
        return theme
    }

    return (
        <motion.div
            key={String(isMounted)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center overflow-hidden rounded-full bg-card ring-1 ring-border ring-inset"
            role="radiogroup"
        >
            {THEME_OPTIONS.map((option) => (
                <ThemeOption
                    key={option.value}
                    icon={option.icon}
                    value={option.value}
                    isActive={getActiveValue() === option.value}
                    onClick={handleThemeChange}
                />
            ))}
        </motion.div>
    )
}

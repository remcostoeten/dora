'use client'

import { isTauri } from '@/shared/utils/tauri'
import { AlertCircle, Download } from 'lucide-react'

/**
 * Hook to check if a feature requires the desktop app
 */
export function useDesktopOnly() {
    const isDesktop = isTauri()

    return {
        isDesktop,
        isWeb: !isDesktop,
        message: 'This feature is only available in the desktop app',
        canUse: isDesktop,
    }
}

type DesktopOnlyBannerProps = {
    featureName?: string
    className?: string
}

/**
 * Banner component to show when a feature is desktop-only
 */
export function DesktopOnlyBanner({ featureName, className }: DesktopOnlyBannerProps) {
    const feature = featureName || 'This feature'

    return (
        <div className={`flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 ${className || ''}`}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{feature} is only available in the desktop app.</span>
            <a
                href="https://github.com/your-repo/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
            >
                <Download className="h-3 w-3" />
                Download
            </a>
        </div>
    )
}

type DesktopOnlyGuardProps = {
    children: React.ReactNode
    fallback?: React.ReactNode
    featureName?: string
}

/**
 * Guard component that only renders children in the desktop app
 */
export function DesktopOnlyGuard({ children, fallback, featureName }: DesktopOnlyGuardProps) {
    const { isDesktop } = useDesktopOnly()

    if (!isDesktop) {
        return fallback ?? <DesktopOnlyBanner featureName={featureName} />
    }

    return <>{children}</>
}

/**
 * Utility to wrap an async function with desktop-only check
 * Returns a function that shows an error/message when called on web
 */
export function withDesktopOnly<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    onWebAttempt?: () => void
): T {
    return (async (...args: Parameters<T>) => {
        if (!isTauri()) {
            onWebAttempt?.()
            throw new Error('This feature is only available in the desktop app')
        }
        return fn(...args)
    }) as T
}

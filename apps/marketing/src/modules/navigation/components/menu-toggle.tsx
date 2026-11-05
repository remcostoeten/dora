'use client'

import { CloseIcon, MenuIcon } from '@/shared/icons/icons'
import {
    setMobileNavigationOpen,
    useMobileNavigationOpen
} from '../hooks/use-mobile-navigation'

export function MenuToggle() {
    const open = useMobileNavigationOpen()

    return (
        <button
            type="button"
            data-mobile-navigation-trigger
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setMobileNavigationOpen(!open)}
            className="ms-auto inline-flex size-(--topbar-height) items-center justify-center text-foreground/60 pressable hover:text-foreground focus-visible:bg-foreground/6 focus-visible:text-foreground lg:hidden"
        >
            {open ? (
                <CloseIcon className="size-4" />
            ) : (
                <MenuIcon className="size-4" />
            )}
        </button>
    )
}

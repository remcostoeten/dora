'use client'

import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function getSnapshot() {
    return open
}

function getServerSnapshot() {
    return false
}

/**
 * @name setMobileNavigationOpen
 * @description Opens or closes the full screen docs navigation on small screens.
 *
 * @example
 * setMobileNavigationOpen(false)
 */
export function setMobileNavigationOpen(next: boolean) {
    if (open === next) return
    open = next
    for (const listener of listeners) listener()
}

/**
 * @name useMobileNavigationOpen
 * @description Subscribes to whether the mobile docs navigation is open.
 *
 * @example
 * const open = useMobileNavigationOpen()
 */
export function useMobileNavigationOpen() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

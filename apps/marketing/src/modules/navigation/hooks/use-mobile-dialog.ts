'use client'

import { useEffect, useRef } from 'react'
import { setMobileNavigationOpen } from './use-mobile-navigation'

const focusableSelector =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * @name useMobileDialog
 * @description Traps focus inside the mobile navigation dialog while it is
 * open, closes it on Escape and restores focus when it closes.
 *
 * @example
 * const dialogRef = useMobileDialog(open)
 */
export function useMobileDialog(active: boolean) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        if (!active) return
        const dialog = dialogRef.current
        const previousFocus =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
        function getFocusableElements() {
            return dialog?.querySelectorAll<HTMLElement>(focusableSelector)
        }
        getFocusableElements()?.[0]?.focus()

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setMobileNavigationOpen(false)
                return
            }
            const focusableElements = getFocusableElements()
            if (event.key !== 'Tab' || !focusableElements?.length) return

            const first = focusableElements[0]
            const last = focusableElements[focusableElements.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            const focusTarget =
                previousFocus &&
                previousFocus !== document.body &&
                previousFocus.isConnected
                    ? previousFocus
                    : document.querySelector<HTMLElement>(
                          '[data-mobile-navigation-trigger]'
                      )
            focusTarget?.focus({ preventScroll: true })
        }
    }, [active])

    return dialogRef
}

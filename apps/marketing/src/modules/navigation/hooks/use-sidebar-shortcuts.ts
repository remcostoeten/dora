'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavigationSection } from '../types/navigation'
import {
    getCurrentSection,
    getSectionShortcuts,
    sectionKeys,
    shortcutKeys
} from '../utils/navigation-sections'

type Options = {
    sections: NavigationSection[]
    pathname: string
    enabled: boolean
    onJumpToSection: (index: number) => void
}

function isEditable(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return (
        target.isContentEditable ||
        /^(input|textarea|select)$/i.test(target.tagName)
    )
}

// "Digit1" and "KeyA" are layout independent, so Shift+1 is a 1 even where it types "!"
function keyFromCode(code: string) {
    return /^(Digit|Key)(\w)$/.exec(code)?.[2]
}

/**
 * @name useSidebarShortcuts
 * @description Keyboard shortcuts for the sidebar. While Shift is held every
 * section shows a letter and the pages of the active section show a digit.
 * Shift+letter makes that section active and focuses its first page,
 * Shift+digit opens the page. `jumps` counts section jumps so the caller can
 * react to a repeated one.
 *
 * @example
 * const { held, sectionIndex, jumps, pageShortcuts } = useSidebarShortcuts({ sections, pathname, enabled, onJumpToSection })
 */
export function useSidebarShortcuts({
    sections,
    pathname,
    enabled,
    onJumpToSection
}: Options) {
    const router = useRouter()
    const [held, setHeld] = useState(false)
    const [sectionIndex, setSectionIndex] = useState(() =>
        getCurrentSection(sections, pathname)
    )
    const [jumps, setJumps] = useState(0)
    const pageShortcuts = useMemo(
        () =>
            sections[sectionIndex]
                ? getSectionShortcuts(sections[sectionIndex])
                : new Map(),
        [sections, sectionIndex]
    )
    const latest = useRef({ pageShortcuts, onJumpToSection })

    useEffect(() => {
        latest.current = { pageShortcuts, onJumpToSection }
    })

    useEffect(() => {
        if (!enabled) return
        const sidebarVisible = window.matchMedia('(min-width: 64rem)')

        function onKeyDown(event: KeyboardEvent) {
            if (isEditable(event.target) || !sidebarVisible.matches) return

            if (event.key === 'Shift') {
                if (!event.repeat) setHeld(true)
                return
            }

            if (
                !event.shiftKey ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey
            )
                return
            const key = keyFromCode(event.code)
            if (!key) return

            const section = sectionKeys.indexOf(
                key as (typeof sectionKeys)[number]
            )
            if (section !== -1 && section < sections.length) {
                event.preventDefault()
                setSectionIndex(section)
                setJumps((count) => count + 1)
                latest.current.onJumpToSection(section)
                return
            }

            if (!shortcutKeys.includes(key as (typeof shortcutKeys)[number]))
                return
            const url = [...latest.current.pageShortcuts].find(
                ([, digit]) => digit === key
            )?.[0]
            if (!url) return
            event.preventDefault()
            setHeld(false)
            router.push(url)
        }

        function onKeyUp(event: KeyboardEvent) {
            if (event.key === 'Shift') setHeld(false)
        }

        function onBlur() {
            setHeld(false)
        }

        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        window.addEventListener('blur', onBlur)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            window.removeEventListener('blur', onBlur)
        }
    }, [enabled, router, sections])

    return { held, sectionIndex, jumps, pageShortcuts }
}

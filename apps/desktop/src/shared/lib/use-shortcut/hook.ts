"use client"

import { useEffect, useRef, useMemo } from "react"
import { createShortcutBuilder } from "./builder"
import type { ShortcutBuilder, UseShortcutOptions } from "./types"

export function useShortcut(options: UseShortcutOptions = {}): ShortcutBuilder {
    const optionsRef = useRef(options)
    optionsRef.current = options

    const { builder, registry } = useMemo(() => {
        return createShortcutBuilder(optionsRef.current)
    }, [])

    useEffect(() => {
        registry.options = optionsRef.current
    })

    useEffect(() => {
        return () => {
            registry.listeners.forEach((entry) => entry.unbind())
            registry.listeners.clear()
        }
    }, [registry])

    return builder as ShortcutBuilder
}

export function createShortcut(options: UseShortcutOptions = {}): ShortcutBuilder {
    const { builder } = createShortcutBuilder(options)
    return builder as ShortcutBuilder
}

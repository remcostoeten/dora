'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSetting, setSetting } from '@/core/tauri'

export type AccentPreset = {
    name: string
    hue: number
}

export const ACCENT_PRESETS: AccentPreset[] = [
    { name: 'Blue', hue: 250 },
    { name: 'Purple', hue: 280 },
    { name: 'Violet', hue: 300 },
    { name: 'Rose', hue: 350 },
    { name: 'Red', hue: 25 },
    { name: 'Orange', hue: 45 },
    { name: 'Amber', hue: 65 },
    { name: 'Green', hue: 145 },
    { name: 'Teal', hue: 180 },
    { name: 'Cyan', hue: 200 },
]

type Props = {
    accentHue: number
    accentPreset: AccentPreset | null
    setAccentHue: (hue: number) => void
    setAccentPreset: (preset: AccentPreset) => void
    presets: AccentPreset[]
}

const AccentContext = createContext<Props | undefined>(undefined)

const STORAGE_KEY = 'accent-hue'
const DEFAULT_HUE = 250 // Blue

function applyHue(hue: number) {
    document.documentElement.style.setProperty('--primary-hue', String(hue))
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
    const [accentHue, setAccentHueState] = useState<number>(DEFAULT_HUE)

    useEffect(() => {
        // 1. Fast path: load from localStorage
        const storedLocal = localStorage.getItem(STORAGE_KEY)
        if (storedLocal) {
            const hue = parseInt(storedLocal, 10)
            if (!isNaN(hue)) {
                applyHue(hue)
                setAccentHueState(hue)
            }
        }

        // 2. Load from Tauri DB (source of truth)
        getSetting<number>(STORAGE_KEY)
            .then((storedDb) => {
                if (storedDb !== null && typeof storedDb === 'number') {
                    applyHue(storedDb)
                    setAccentHueState(storedDb)
                    // Sync localStorage if drifted
                    if (localStorage.getItem(STORAGE_KEY) !== String(storedDb)) {
                        localStorage.setItem(STORAGE_KEY, String(storedDb))
                    }
                }
            })
            .catch(console.error)
    }, [])

    const setAccentHue = useCallback((hue: number) => {
        applyHue(hue)
        setAccentHueState(hue)
        localStorage.setItem(STORAGE_KEY, String(hue))

        // Persist to DB asynchronously
        setSetting(STORAGE_KEY, hue).catch(console.error)
    }, [])

    const setAccentPreset = useCallback((preset: AccentPreset) => {
        setAccentHue(preset.hue)
    }, [setAccentHue])

    const accentPreset = ACCENT_PRESETS.find(p => p.hue === accentHue) || null

    return (
        <AccentContext.Provider
            value={{
                accentHue,
                accentPreset,
                setAccentHue,
                setAccentPreset,
                presets: ACCENT_PRESETS,
            }}
        >
            {children}
        </AccentContext.Provider>
    )
}

export function useAccent() {
    const context = useContext(AccentContext)
    if (!context) {
        throw new Error('useAccent must be used within AccentProvider')
    }
    return context
}

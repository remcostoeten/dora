'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSetting, setSetting } from '@/core/tauri'

export type RadiusPreset = {
    name: string
    value: number // in rem
}

export const RADIUS_PRESETS: RadiusPreset[] = [
    { name: 'None', value: 0 },
    { name: 'Small', value: 0.375 },
    { name: 'Medium', value: 0.5 },
    { name: 'Default', value: 0.75 },
    { name: 'Large', value: 1 },
    { name: 'Full', value: 1.5 },
]

type ThemeConfigContextType = {
    borderRadius: number
    setBorderRadius: (radius: number) => void
    radiusPresets: RadiusPreset[]
}

const ThemeConfigContext = createContext<ThemeConfigContextType | undefined>(undefined)

const RADIUS_STORAGE_KEY = 'border-radius'
const DEFAULT_RADIUS = 0.75 // rem

function applyRadius(radius: number) {
    document.documentElement.style.setProperty('--radius', `${radius}rem`)
}

export function ThemeConfigProvider({ children }: { children: React.ReactNode }) {
    const [borderRadius, setBorderRadiusState] = useState<number>(DEFAULT_RADIUS)

    useEffect(() => {
        // 1. Fast path: load from localStorage
        const storedLocal = localStorage.getItem(RADIUS_STORAGE_KEY)
        if (storedLocal) {
            const radius = parseFloat(storedLocal)
            if (!isNaN(radius)) {
                applyRadius(radius)
                setBorderRadiusState(radius)
            }
        }

        // 2. Load from Tauri DB (source of truth)
        getSetting<number>(RADIUS_STORAGE_KEY)
            .then((storedDb) => {
                if (storedDb !== null && typeof storedDb === 'number') {
                    applyRadius(storedDb)
                    setBorderRadiusState(storedDb)
                    // Sync localStorage if drifted
                    if (localStorage.getItem(RADIUS_STORAGE_KEY) !== String(storedDb)) {
                        localStorage.setItem(RADIUS_STORAGE_KEY, String(storedDb))
                    }
                }
            })
            .catch(console.error)
    }, [])

    const setBorderRadius = useCallback((radius: number) => {
        applyRadius(radius)
        setBorderRadiusState(radius)
        localStorage.setItem(RADIUS_STORAGE_KEY, String(radius))

        // Persist to DB asynchronously
        setSetting(RADIUS_STORAGE_KEY, radius).catch(console.error)
    }, [])

    return (
        <ThemeConfigContext.Provider
            value={{
                borderRadius,
                setBorderRadius,
                radiusPresets: RADIUS_PRESETS,
            }}
        >
            {children}
        </ThemeConfigContext.Provider>
    )
}

export function useThemeConfig() {
    const context = useContext(ThemeConfigContext)
    if (!context) {
        throw new Error('useThemeConfig must be used within ThemeConfigProvider')
    }
    return context
}

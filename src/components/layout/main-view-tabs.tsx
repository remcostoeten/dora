'use client'

import { useState, useEffect } from 'react'
import { Code2, Table2 } from 'lucide-react'
import { getSetting, setSetting } from '@/core/tauri'

export type MainViewMode = 'query-runner' | 'data-browser'

type MainViewTabsProps = {
    mode: MainViewMode
    onModeChange: (mode: MainViewMode) => void
    disabled?: boolean
}

export function MainViewTabs({ mode, onModeChange, disabled }: MainViewTabsProps) {
    return (
        <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2">
            <button
                onClick={() => onModeChange('query-runner')}
                disabled={disabled}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-t-md ${mode === 'query-runner'
                        ? 'bg-card text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <Code2 className="h-4 w-4" />
                Query Runner
            </button>
            <button
                onClick={() => onModeChange('data-browser')}
                disabled={disabled}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-t-md ${mode === 'data-browser'
                        ? 'bg-card text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <Table2 className="h-4 w-4" />
                Data Browser
            </button>
        </div>
    )
}

// Hook to manage main view mode with persistence
export function useMainViewMode() {
    const [mode, setModeState] = useState<MainViewMode>('query-runner')

    useEffect(() => {
        // Load from localStorage first (fast)
        const stored = localStorage.getItem('main-view-mode') as MainViewMode | null
        if (stored) setModeState(stored)

        // Then from Tauri DB
        getSetting<MainViewMode>('main-view-mode')
            .then((dbMode) => {
                if (dbMode) setModeState(dbMode)
            })
            .catch(console.error)
    }, [])

    const setMode = (newMode: MainViewMode) => {
        setModeState(newMode)
        localStorage.setItem('main-view-mode', newMode)
        setSetting('main-view-mode', newMode).catch(console.error)
    }

    return { mode, setMode }
}

'use client'

import { useEffect, useState } from 'react'

import { noop } from '@/shared/lib/noop'

/* Dev-only palette knob. Drives the same --brand-hue / --brand-chroma pair
 * globals.css derives every brand color from, live, and persists the values
 * so they survive reloads while you dial the site in. Never ships: the layout
 * only renders it when NODE_ENV === 'development'. */

const STORAGE_KEY = 'dora-brand-tuner'

const PRESETS = [
    { label: 'Indigo', hue: 265, chroma: 1 },
    { label: 'Gold', hue: 75, chroma: 1 },
    { label: 'Blush', hue: 18, chroma: 1 },
    { label: 'Green', hue: 150, chroma: 1 },
    { label: 'Mono', hue: 265, chroma: 0 }
]

type TKnobs = { hue: number; chroma: number }

function readStored(): TKnobs | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (
            typeof parsed?.hue !== 'number' ||
            typeof parsed?.chroma !== 'number'
        )
            return null
        return parsed
    } catch {
        noop()
        return null
    }
}

function readCssDefaults(): TKnobs {
    const style = getComputedStyle(document.documentElement)
    return {
        hue: Number(style.getPropertyValue('--brand-hue')) || 265,
        chroma: Number(style.getPropertyValue('--brand-chroma')) || 0
    }
}

function apply(knobs: TKnobs) {
    const root = document.documentElement
    root.style.setProperty('--brand-hue', String(knobs.hue))
    root.style.setProperty('--brand-chroma', String(knobs.chroma))
}

export function BrandTuner() {
    const [open, setOpen] = useState(false)
    const [knobs, setKnobs] = useState<TKnobs | null>(null)

    useEffect(() => {
        const initial = readStored()
        if (initial) {
            apply(initial)
            setKnobs(initial)
        } else {
            setKnobs(readCssDefaults())
        }
    }, [])

    if (!knobs) return null

    function update(next: TKnobs) {
        setKnobs(next)
        apply(next)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
            noop()
        }
    }

    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            noop()
        }
        const root = document.documentElement
        root.style.removeProperty('--brand-hue')
        root.style.removeProperty('--brand-chroma')
        setKnobs(readCssDefaults())
    }

    function copy() {
        if (!knobs) return
        navigator.clipboard
            .writeText(
                `--brand-hue: ${knobs.hue};\n--brand-chroma: ${knobs.chroma};`
            )
            .catch(noop)
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] font-mono text-[11px] text-ink-300">
            {open ? (
                <div className="w-64 border border-line-strong bg-surface p-3 shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="uppercase tracking-[0.14em] text-ink-500">
                            Brand tuner
                        </span>
                        <button
                            className="text-ink-600 hover:text-ink-200"
                            type="button"
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    <label className="mb-1 flex items-center justify-between">
                        <span>hue</span>
                        <span className="tabular-nums text-brand-300">
                            {knobs.hue}
                        </span>
                    </label>
                    <input
                        className="mb-3 w-full accent-[var(--color-brand-300)]"
                        max={360}
                        min={0}
                        step={1}
                        type="range"
                        value={knobs.hue}
                        onChange={(e) =>
                            update({ ...knobs, hue: Number(e.target.value) })
                        }
                    />

                    <label className="mb-1 flex items-center justify-between">
                        <span>chroma</span>
                        <span className="tabular-nums text-brand-300">
                            {knobs.chroma.toFixed(2)}
                        </span>
                    </label>
                    <input
                        className="mb-3 w-full accent-[var(--color-brand-300)]"
                        max={2.5}
                        min={0}
                        step={0.05}
                        type="range"
                        value={knobs.chroma}
                        onChange={(e) =>
                            update({ ...knobs, chroma: Number(e.target.value) })
                        }
                    />

                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                className="border border-line px-1.5 py-0.5 text-[10px] text-ink-400 transition-colors hover:border-brand-600 hover:text-brand-200"
                                type="button"
                                onClick={() =>
                                    update({
                                        hue: preset.hue,
                                        chroma: preset.chroma
                                    })
                                }
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            className="border border-line px-2 py-1 text-[10px] text-ink-400 transition-colors hover:border-brand-600 hover:text-brand-200"
                            type="button"
                            onClick={copy}
                        >
                            Copy CSS
                        </button>
                        <button
                            className="text-[10px] text-ink-600 hover:text-ink-200"
                            type="button"
                            onClick={reset}
                        >
                            reset
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    aria-label="Open brand tuner"
                    className="flex h-9 w-9 items-center justify-center border border-line-strong bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-colors hover:border-brand-600"
                    type="button"
                    onClick={() => setOpen(true)}
                >
                    <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{
                            background:
                                'conic-gradient(from 0deg, oklch(70% 0.16 0), oklch(70% 0.16 90), oklch(70% 0.16 180), oklch(70% 0.16 270), oklch(70% 0.16 360))'
                        }}
                    />
                </button>
            )}
        </div>
    )
}

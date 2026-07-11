'use client'

import { Palette } from 'lucide-react'

const SWATCHES = ['#f5c0c0', '#9b84d4', '#6b8cae', '#6aab7e', '#d4a84b']
const ACCENT = SWATCHES[0]

export function ThemingCard({ animate }: { animate: boolean }) {
    return (
        <div className="flex h-full w-full flex-col gap-0 p-6 pt-7">
            <div className="mb-5 flex items-center gap-2">
                <Palette className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                <span className="text-[12px] font-medium text-ink-350">
                    Appearance
                </span>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-ink-700">
                        Base theme
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(['Dark', 'Dim', 'Light'] as const).map((t, i) => (
                            <div
                                key={t}
                                className={[
                                    'flex flex-col gap-1 rounded-md border p-2 text-[10px]',
                                    i === 0
                                        ? 'border-brand-200/30 bg-brand-200/5 text-ink-350'
                                        : 'border-line text-ink-700',
                                ].join(' ')}
                            >
                                <div
                                    className="h-4 w-full rounded-sm"
                                    style={{
                                        background: i === 0 ? 'var(--color-surface-deeper)' : i === 1 ? 'var(--color-surface-elevated)' : 'var(--color-ink-50)',
                                    }}
                                />
                                {t}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-ink-700">
                        Accent
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                        {SWATCHES.map((s, i) => (
                            <div
                                key={s}
                                className={[
                                    'h-5 w-5 rounded-full transition-transform',
                                    animate ? 'duration-300' : '',
                                    i === 0 ? 'ring-1 ring-offset-1 ring-offset-[var(--color-surface-deeper)] scale-110' : '',
                                ].join(' ')}
                                style={{ backgroundColor: s }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-auto rounded-lg border border-line bg-surface-deep p-3">
                <div className="flex flex-col gap-1.5">
                    <div className="h-1.5 w-2/3 rounded-sm" style={{ backgroundColor: ACCENT, opacity: 0.7 }} />
                    <div className="h-1 w-full rounded-sm bg-line" />
                    <div className="h-1 w-5/6 rounded-sm bg-line" />
                    <div
                        className="mt-0.5 h-4 w-full rounded"
                        style={{ backgroundColor: ACCENT, opacity: 0.12 }}
                    />
                </div>
            </div>
        </div>
    )
}

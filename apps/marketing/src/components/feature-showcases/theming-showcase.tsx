'use client'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'

const SWATCHES = [
    { label: 'Sakura', value: '#f5c0c0' },
    { label: 'Iris', value: '#9b84d4' },
    { label: 'Slate', value: '#6b8cae' },
    { label: 'Moss', value: '#6aab7e' },
    { label: 'Amber', value: '#d4a84b' },
]

const SELECTED = SWATCHES[0]

export function ThemingShowcase() {
    return (
        <div className="flex h-full w-full overflow-hidden">
            <FeatureShowcaseRail demo="theming" />

            <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
                <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Appearance</span>
                    <span className="text-border">/</span>
                    <span>Theme</span>
                </header>

                <div className="flex flex-1 overflow-auto p-5 gap-6">
                    <div className="flex flex-col gap-5 min-w-0 flex-1">
                        <section className="flex flex-col gap-2">
                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                                Base theme
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Dark', 'Dim', 'Light'] as const).map((t, i) => (
                                    <button
                                        key={t}
                                        type="button"
                                        className={[
                                            'flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors',
                                            i === 0
                                                ? 'border-brand-200/40 bg-brand-200/6'
                                                : 'border-border bg-card hover:border-border/80',
                                        ].join(' ')}
                                    >
                                        <div
                                            className="h-8 w-full rounded"
                                            style={{
                                                background: i === 0
                                                    ? 'var(--color-surface-deeper)'
                                                    : i === 1
                                                    ? 'var(--color-surface-elevated)'
                                                    : 'var(--color-ink-50)',
                                            }}
                                        />
                                        <span className="text-[11px] text-foreground/80">{t}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                                Accent colour
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                {SWATCHES.map((s) => (
                                    <button
                                        key={s.label}
                                        type="button"
                                        title={s.label}
                                        className={[
                                            'flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110',
                                            s.label === SELECTED.label
                                                ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                                                : '',
                                        ].join(' ')}
                                        style={{ backgroundColor: s.value }}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                                Font
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['System UI', 'Geist'] as const).map((f, i) => (
                                    <button
                                        key={f}
                                        type="button"
                                        className={[
                                            'rounded-lg border p-3 text-left text-[12px] transition-colors',
                                            i === 1
                                                ? 'border-brand-200/40 bg-brand-200/6 text-foreground'
                                                : 'border-border bg-card text-muted-foreground',
                                        ].join(' ')}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>

                    <aside className="w-40 shrink-0 flex flex-col gap-3">
                        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            Preview
                        </p>
                        <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 text-[10px]">
                            <div className="h-2 w-3/4 rounded-sm" style={{ backgroundColor: SELECTED.value, opacity: 0.8 }} />
                            <div className="h-1.5 w-full rounded-sm bg-muted" />
                            <div className="h-1.5 w-5/6 rounded-sm bg-muted" />
                            <div className="mt-1 h-5 w-full rounded" style={{ backgroundColor: SELECTED.value, opacity: 0.15 }} />
                        </div>
                    </aside>
                </div>

                <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-border px-4">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SELECTED.value }} />
                    <span className="text-[10px] text-muted-foreground">
                        Theme: Dark · Accent: {SELECTED.label}
                    </span>
                </footer>
            </div>
        </div>
    )
}

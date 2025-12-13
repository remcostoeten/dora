'use client'

import { useState } from 'react'
import { useTheme } from '@/core/state/theme-provider'
import { useAccent, ACCENT_PRESETS } from '@/core/state/accent-provider'
import { useThemeConfig, RADIUS_PRESETS } from '@/core/state/theme-config-provider'
import { Settings, Sun, Moon, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Dialog primitives
function Dialog({ open, onOpenChange, children }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />
            <div className="relative z-50 animate-in fade-in-0 zoom-in-95">
                {children}
            </div>
        </div>
    )
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-card rounded-lg border border-border shadow-xl ${className || ''}`}>
            {children}
        </div>
    )
}

// Color swatch component
function ColorSwatch({ hue, isActive, onClick }: { hue: number; isActive: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`relative h-8 w-8 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isActive ? 'ring-2 ring-offset-2 ring-foreground/50' : ''
                }`}
            style={{
                backgroundColor: `oklch(0.6 0.18 ${hue})`,
            }}
            title={ACCENT_PRESETS.find(p => p.hue === hue)?.name}
        >
            {isActive && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
            )}
        </button>
    )
}

// Radius preview component
function RadiusPreview({ radius, isActive, onClick, name }: {
    radius: number
    isActive: boolean
    onClick: () => void
    name: string
}) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1.5 p-2 transition-all duration-200 rounded-md hover:bg-muted ${isActive ? 'bg-primary/10 ring-1 ring-primary' : ''
                }`}
        >
            <div
                className="w-10 h-10 border-2 border-primary bg-primary/10"
                style={{ borderRadius: `${radius}rem` }}
            />
            <span className="text-xs text-muted-foreground">{name}</span>
        </button>
    )
}

// Live preview card
function PreviewCard() {
    return (
        <div className="p-4 rounded-lg border border-border bg-background space-y-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary" />
                <div className="space-y-1">
                    <div className="h-3 w-24 rounded bg-foreground/20" />
                    <div className="h-2 w-16 rounded bg-muted-foreground/20" />
                </div>
            </div>
            <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">
                    Button
                </button>
                <button className="px-3 py-1.5 text-xs rounded-md border border-border bg-transparent">
                    Secondary
                </button>
            </div>
            <input
                type="text"
                placeholder="Input preview"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-input"
                readOnly
            />
        </div>
    )
}

export function ThemeSettings() {
    const [open, setOpen] = useState(false)
    const { theme, toggleTheme } = useTheme()
    const { accentHue, setAccentHue, presets } = useAccent()
    const { borderRadius, setBorderRadius, radiusPresets } = useThemeConfig()

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Theme Settings"
                onClick={() => setOpen(true)}
            >
                <Settings className="h-4 w-4" />
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-[420px] max-h-[85vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <h2 className="text-lg font-semibold">Appearance</h2>
                        <button
                            onClick={() => setOpen(false)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-4 space-y-6">
                        {/* Theme Toggle */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Theme</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => theme !== 'light' && toggleTheme()}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors ${theme === 'light'
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <Sun className="h-4 w-4" />
                                    Light
                                </button>
                                <button
                                    onClick={() => theme !== 'dark' && toggleTheme()}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors ${theme === 'dark'
                                        ? 'border-primary bg-primary/10 text-foreground'
                                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <Moon className="h-4 w-4" />
                                    Dark
                                </button>
                            </div>
                        </div>

                        {/* Accent Color */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Accent Color</label>
                            <div className="grid grid-cols-5 gap-2">
                                {presets.map((preset) => (
                                    <ColorSwatch
                                        key={preset.hue}
                                        hue={preset.hue}
                                        isActive={accentHue === preset.hue}
                                        onClick={() => setAccentHue(preset.hue)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Border Radius */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Border Radius</label>
                            <div className="grid grid-cols-6 gap-1">
                                {radiusPresets.map((preset) => (
                                    <RadiusPreview
                                        key={preset.value}
                                        radius={preset.value}
                                        name={preset.name}
                                        isActive={borderRadius === preset.value}
                                        onClick={() => setBorderRadius(preset.value)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Live Preview */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Preview</label>
                            <PreviewCard />
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

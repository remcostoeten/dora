import { useState, useEffect } from "react";
import { SidebarPanel } from "./sidebar-panel";
import { ThemePreviewCard } from "./theme-preview-card";
import { cn } from "@/shared/utils/cn";
import {
    type Theme,
    type FontPair,
    type Density,
    type AppearanceSettings,
    getAppearanceSettings,
    saveAppearanceSettings,
    applyAppearanceToDOM,
} from "@/shared/lib/appearance-store";
import { loadFontPair } from "@/shared/lib/font-loader";

type ThemeConfig = {
    value: Theme;
    name: string;
    variant: "dark" | "light";
    accentColor: string;
};

type FontConfig = {
    value: FontPair;
    name: string;
    description: string;
};

type DensityConfig = {
    value: Density;
    name: string;
    icon: string;
};

const THEME_OPTIONS: ThemeConfig[] = [
    { value: "dark", name: "Classic Dark", variant: "dark", accentColor: "#e5e5e5" },
    { value: "light", name: "Light", variant: "light", accentColor: "#171717" },
    { value: "midnight", name: "Midnight", variant: "dark", accentColor: "#818cf8" },
    { value: "forest", name: "Forest", variant: "dark", accentColor: "#34d399" },
    { value: "claude", name: "Claude Light", variant: "light", accentColor: "#d97706" },
    { value: "claude-dark", name: "Claude Dark", variant: "dark", accentColor: "#b45309" },
];

const FONT_OPTIONS: FontConfig[] = [
    { value: "system", name: "System", description: "Inter + JetBrains Mono" },
    { value: "serif", name: "Serif", description: "Merriweather + Fira Code" },
    { value: "compact", name: "Compact", description: "IBM Plex Sans/Mono" },
    { value: "playful", name: "Playful", description: "Nunito + Source Code Pro" },
];

const DENSITY_OPTIONS: DensityConfig[] = [
    { value: "compact", name: "Compact", icon: "▪▪▪" },
    { value: "comfortable", name: "Comfortable", icon: "▪ ▪ ▪" },
    { value: "spacious", name: "Spacious", icon: "▪  ▪  ▪" },
];

export function AppearancePanel() {
    const [settings, setSettings] = useState<AppearanceSettings>(getAppearanceSettings);

    useEffect(function initializeAppearance() {
        applyAppearanceToDOM(settings);
    }, []);

    function handleThemeChange(theme: Theme) {
        const updated = saveAppearanceSettings({ theme });
        setSettings(updated);
        applyAppearanceToDOM(updated);
    }

    async function handleFontChange(fontPair: FontPair) {
        await loadFontPair(fontPair);
        const updated = saveAppearanceSettings({ fontPair });
        setSettings(updated);
        applyAppearanceToDOM(updated);
    }

    function handleDensityChange(density: Density) {
        const updated = saveAppearanceSettings({ density });
        setSettings(updated);
        applyAppearanceToDOM(updated);
    }

    return (
        <SidebarPanel>
            <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
                {/* Theme Section */}
                <section>
                    <h3 className="text-sm font-semibold text-sidebar-foreground mb-1">Theme</h3>
                    <p className="text-xs text-muted-foreground mb-3">Choose your color scheme</p>
                    <div className="grid grid-cols-2 gap-2">
                        {THEME_OPTIONS.map(function (option) {
                            return (
                                <ThemePreviewCard
                                    key={option.value}
                                    name={option.name}
                                    isSelected={settings.theme === option.value}
                                    onClick={function () { handleThemeChange(option.value); }}
                                    variant={option.variant}
                                    accentColor={option.accentColor}
                                />
                            );
                        })}
                    </div>
                </section>

                {/* Font Section */}
                <section>
                    <h3 className="text-sm font-semibold text-sidebar-foreground mb-1">Font</h3>
                    <p className="text-xs text-muted-foreground mb-3">Select your preferred typography</p>
                    <div className="grid grid-cols-2 gap-2">
                        {FONT_OPTIONS.map(function (option) {
                            const isSelected = settings.fontPair === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={function () { handleFontChange(option.value); }}
                                    className={cn(
                                        "flex flex-col items-start p-3 rounded-lg border transition-all text-left",
                                        isSelected
                                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                            : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                                    )}
                                >
                                    <span className="text-sm font-medium text-foreground">{option.name}</span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">{option.description}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Density Section */}
                <section>
                    <h3 className="text-sm font-semibold text-sidebar-foreground mb-1">Density</h3>
                    <p className="text-xs text-muted-foreground mb-3">Adjust UI spacing</p>
                    <div className="flex gap-2">
                        {DENSITY_OPTIONS.map(function (option) {
                            const isSelected = settings.density === option.value;
                            return (
                                <button
                                    key={option.value}
                                    onClick={function () { handleDensityChange(option.value); }}
                                    className={cn(
                                        "flex-1 flex flex-col items-center py-3 px-2 rounded-lg border transition-all",
                                        isSelected
                                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                            : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                                    )}
                                >
                                    <span className="text-xs font-mono tracking-widest mb-1">{option.icon}</span>
                                    <span className="text-xs text-foreground">{option.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </div>
        </SidebarPanel>
    );
}

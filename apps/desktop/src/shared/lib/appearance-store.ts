/**
 * Appearance Store
 * Manages theme, font pair, and UI density preferences with localStorage persistence.
 */

export type Theme = "dark" | "light" | "midnight" | "forest" | "claude" | "claude-dark";
export type FontPair = "system" | "serif" | "compact" | "playful";
export type Density = "comfortable" | "compact" | "spacious";

export type AppearanceSettings = {
    theme: Theme;
    fontPair: FontPair;
    density: Density;
};

const STORAGE_KEY = "dora-appearance";

const DEFAULT_SETTINGS: AppearanceSettings = {
    theme: "dark",
    fontPair: "system",
    density: "comfortable",
};

export function getAppearanceSettings(): AppearanceSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn("Failed to load appearance settings:", e);
    }
    return DEFAULT_SETTINGS;
}

export function saveAppearanceSettings(settings: Partial<AppearanceSettings>): AppearanceSettings {
    const current = getAppearanceSettings();
    const updated = { ...current, ...settings };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.warn("Failed to save appearance settings:", e);
    }
    return updated;
}

export function applyAppearanceToDOM(settings: AppearanceSettings): void {
    const root = document.documentElement;

    // Theme
    root.classList.remove("light", "dark", "midnight", "forest", "claude", "claude-dark");
    root.classList.add(settings.theme);

    // Font Pair
    root.classList.remove("font-system", "font-serif", "font-compact", "font-playful");
    root.classList.add(`font-${settings.fontPair}`);

    // Density
    root.classList.remove("density-comfortable", "density-compact", "density-spacious");
    root.classList.add(`density-${settings.density}`);
}

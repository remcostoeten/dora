/**
 * Dynamic Font Loader
 * Loads Google Fonts on-demand when a font pair is selected.
 * Only the "system" fonts (Inter, JetBrains Mono) are preloaded.
 */

import type { FontPair } from "./appearance-store";

type FontConfig = {
    sans: string;
    mono: string;
    url: string;
};

const FONT_CONFIGS: Record<Exclude<FontPair, "system">, FontConfig> = {
    serif: {
        sans: "Merriweather",
        mono: "Fira Code",
        url: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Fira+Code:wght@400;500&display=swap",
    },
    compact: {
        sans: "IBM Plex Sans",
        mono: "IBM Plex Mono",
        url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
    },
    playful: {
        sans: "Nunito",
        mono: "Source Code Pro",
        url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Source+Code+Pro:wght@400;500&display=swap",
    },
    technical: {
        sans: "Roboto",
        mono: "Roboto Mono",
        url: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap",
    },
    vintage: {
        sans: "Space Grotesk",
        mono: "Space Mono",
        url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap",
    },
};

const loadedFonts = new Set<FontPair>(["system"]);

export async function loadFontPair(fontPair: FontPair): Promise<void> {
    if (fontPair === "system" || loadedFonts.has(fontPair)) {
        return;
    }

    const config = FONT_CONFIGS[fontPair];
    if (!config) {
        console.warn(`Unknown font pair: ${fontPair}`);
        return;
    }

    // Check if link already exists
    const existingLink = document.querySelector(`link[data-font-pair="${fontPair}"]`);
    if (existingLink) {
        loadedFonts.add(fontPair);
        return;
    }

    // Create and inject the link element
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = config.url;
    link.setAttribute("data-font-pair", fontPair);

    return new Promise(function (resolve, reject) {
        link.onload = function () {
            loadedFonts.add(fontPair);
            resolve();
        };
        link.onerror = function () {
            console.error(`Failed to load font pair: ${fontPair}`);
            reject(new Error(`Failed to load font pair: ${fontPair}`));
        };
        document.head.appendChild(link);
    });
}

export function getFontFamilies(fontPair: FontPair): { sans: string; mono: string } {
    if (fontPair === "system") {
        return {
            sans: "'Inter', system-ui, sans-serif",
            mono: "'JetBrains Mono', monospace",
        };
    }
    const config = FONT_CONFIGS[fontPair as Exclude<FontPair, "system">];

    if (!config) {
        console.warn(`Unknown font pair: ${fontPair}, falling back to system`);
        return {
            sans: "'Inter', system-ui, sans-serif",
            mono: "'JetBrains Mono', monospace",
        };
    }

    return {
        sans: `'${config.sans}', system-ui, sans-serif`,
        mono: `'${config.mono}', monospace`,
    };
}

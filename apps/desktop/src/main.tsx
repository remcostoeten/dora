import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAppearanceSettings, applyAppearanceToDOM } from "@/shared/lib/appearance-store";
import { loadFontPair } from "@/shared/lib/font-loader";

// Initialize appearance before rendering to prevent theme flash
const settings = getAppearanceSettings();
applyAppearanceToDOM(settings);
if (settings.fontPair !== "system") {
    loadFontPair(settings.fontPair);
}

createRoot(document.getElementById("root")!).render(<App />);

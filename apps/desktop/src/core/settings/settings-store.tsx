import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { commands } from "@/lib/bindings";

// ============================================================================
// Settings Types
// ============================================================================

export type SettingsState = {
  confirmBeforeDelete: boolean;
  editorFontSize: number;
  restoreLastConnection: boolean;
  lastConnectionId: string | null;
};

export const DEFAULT_SETTINGS: SettingsState = {
  confirmBeforeDelete: true,
  editorFontSize: 14,
  restoreLastConnection: true,
  lastConnectionId: null,
};

const STORAGE_KEY = "ui_settings";

// ============================================================================
// Settings Context
// ============================================================================

type SettingsContextValue = {
  settings: SettingsState;
  isLoading: boolean;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================================================
// Storage Helpers (using Tauri backend)
// ============================================================================

async function loadSettingsFromBackend(): Promise<SettingsState> {
  try {
    const result = await commands.getSetting(STORAGE_KEY);
    if (result.status === "ok" && result.data) {
      const parsed = JSON.parse(result.data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn("Failed to load settings from backend:", error);
  }
  return DEFAULT_SETTINGS;
}

async function saveSettingsToBackend(settings: SettingsState): Promise<void> {
  try {
    const serialized = JSON.stringify(settings);
    await commands.setSetting(STORAGE_KEY, serialized);
  } catch (error) {
    console.warn("Failed to save settings to backend:", error);
  }
}

// ============================================================================
// Settings Provider
// ============================================================================

type SettingsProviderProps = {
  children: ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    async function load() {
      const loaded = await loadSettingsFromBackend();
      setSettings(loaded);
      setIsLoading(false);
      initialLoadDone.current = true;
    }
    load();
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettingsToBackend(settings);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((partial: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSetting,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export function useSetting<K extends keyof SettingsState>(
  key: K
): [SettingsState[K], (value: SettingsState[K]) => void] {
  const { settings, updateSetting } = useSettings();
  const setValue = useCallback(
    (value: SettingsState[K]) => updateSetting(key, value),
    [key, updateSetting]
  );
  return [settings[key], setValue];
}

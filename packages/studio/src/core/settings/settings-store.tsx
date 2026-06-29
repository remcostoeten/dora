import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
	useCallback,
	useRef
} from 'react'
import { commands } from '@studio/lib/bindings'
import { MonacoTheme } from './editor-themes'

export type EditorTheme = 'auto' | MonacoTheme

export type SettingsState = {
	confirmBeforeDelete: boolean
	editorFontSize: number
	editorTheme: EditorTheme
	enableVimMode: boolean
	privacyMaskData: boolean
	restoreLastConnection: boolean
	restoreTabsOnLaunch: boolean
	startupConnectionMode: 'auto' | 'empty'
	lastConnectionId: string | null
	lastTableId: string | null
	lastRowPK: string | number | null
	selectionBarStyle: 'floating' | 'static'
	showToasts: boolean
}

export const DEFAULT_SETTINGS: SettingsState = {
	confirmBeforeDelete: true,
	editorFontSize: 14,
	editorTheme: 'auto',
	enableVimMode: false,
	privacyMaskData: false,
	restoreLastConnection: true,
	restoreTabsOnLaunch: true,
	startupConnectionMode: 'auto',
	lastConnectionId: null,
	lastTableId: null,
	lastRowPK: null,
	selectionBarStyle: 'floating',
	showToasts: true
}

const STORAGE_KEY = 'ui_settings'
const EDITOR_THEMES: ReadonlySet<EditorTheme> = new Set([
	'auto',
	'vs',
	'vs-dark',
	'dracula',
	'nord',
	'monokai',
	'github-dark',
	'github-light'
])
const SELECTION_BAR_STYLES: ReadonlySet<SettingsState['selectionBarStyle']> = new Set([
	'floating',
	'static'
])
const STARTUP_CONNECTION_MODES: ReadonlySet<SettingsState['startupConnectionMode']> = new Set([
	'auto',
	'empty'
])

function isTauriRuntime(): boolean {
	return (
		typeof window !== 'undefined' &&
		('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null
}

function optionalRowPk(value: unknown): string | number | null {
	if (typeof value === 'string' || typeof value === 'number') return value
	return null
}

function clampEditorFontSize(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS.editorFontSize
	return Math.min(24, Math.max(10, Math.round(value)))
}

export function sanitizeSettings(value: unknown): SettingsState {
	if (!isRecord(value)) return DEFAULT_SETTINGS

	const startupConnectionMode = STARTUP_CONNECTION_MODES.has(
		value.startupConnectionMode as SettingsState['startupConnectionMode']
	)
		? (value.startupConnectionMode as SettingsState['startupConnectionMode'])
		: typeof value.restoreLastConnection === 'boolean'
			? value.restoreLastConnection
				? 'auto'
				: 'empty'
			: DEFAULT_SETTINGS.startupConnectionMode

	return {
		confirmBeforeDelete:
			typeof value.confirmBeforeDelete === 'boolean'
				? value.confirmBeforeDelete
				: DEFAULT_SETTINGS.confirmBeforeDelete,
		editorFontSize: clampEditorFontSize(value.editorFontSize),
		editorTheme: EDITOR_THEMES.has(value.editorTheme as EditorTheme)
			? (value.editorTheme as EditorTheme)
			: DEFAULT_SETTINGS.editorTheme,
		enableVimMode:
			typeof value.enableVimMode === 'boolean'
				? value.enableVimMode
				: DEFAULT_SETTINGS.enableVimMode,
		privacyMaskData:
			typeof value.privacyMaskData === 'boolean'
				? value.privacyMaskData
				: DEFAULT_SETTINGS.privacyMaskData,
		restoreLastConnection: startupConnectionMode === 'auto',
		restoreTabsOnLaunch:
			typeof value.restoreTabsOnLaunch === 'boolean'
				? value.restoreTabsOnLaunch
				: DEFAULT_SETTINGS.restoreTabsOnLaunch,
		startupConnectionMode,
		lastConnectionId: optionalString(value.lastConnectionId),
		lastTableId: optionalString(value.lastTableId),
		lastRowPK: optionalRowPk(value.lastRowPK),
		selectionBarStyle: SELECTION_BAR_STYLES.has(
			value.selectionBarStyle as SettingsState['selectionBarStyle']
		)
			? (value.selectionBarStyle as SettingsState['selectionBarStyle'])
			: DEFAULT_SETTINGS.selectionBarStyle,
		showToasts:
			typeof value.showToasts === 'boolean' ? value.showToasts : DEFAULT_SETTINGS.showToasts
	}
}

// ============================================================================
// Settings Context
// ============================================================================

type SettingsContextValue = {
	settings: SettingsState
	isLoading: boolean
	updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
	updateSettings: (partial: Partial<SettingsState>) => void
	resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

async function loadSettingsFromBackend(): Promise<SettingsState> {
	if (!isTauriRuntime()) {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY)
			if (!stored) return DEFAULT_SETTINGS

			const parsed = JSON.parse(stored)
			return sanitizeSettings(parsed)
		} catch (error) {
			console.warn('Failed to load settings from local storage:', error)
			return DEFAULT_SETTINGS
		}
	}

	try {
		const result = await commands.getSetting(STORAGE_KEY)
		if (result.status === 'ok' && result.data) {
			const parsed = JSON.parse(result.data)
			return sanitizeSettings(parsed)
		}
	} catch (error) {
		console.warn('Failed to load settings from backend:', error)
	}
	return DEFAULT_SETTINGS
}

async function saveSettingsToBackend(settings: SettingsState): Promise<void> {
	const sanitized = sanitizeSettings(settings)
	if (!isTauriRuntime()) {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
			return
		} catch (error) {
			console.warn('Failed to save settings to local storage:', error)
			return
		}
	}

	try {
		const serialized = JSON.stringify(sanitized)
		await commands.setSetting(STORAGE_KEY, serialized)
	} catch (error) {
		console.warn('Failed to save settings to backend:', error)
	}
}

// ============================================================================
// Settings Provider
// ============================================================================

type SettingsProviderProps = {
	children: ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
	const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
	const [isLoading, setIsLoading] = useState(true)
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const initialLoadDone = useRef(false)
	const latestSettingsRef = useRef(settings)

	useEffect(
		function syncLatestSettingsRef() {
			latestSettingsRef.current = settings
		},
		[settings]
	)

	useEffect(() => {
		async function load() {
			const loaded = await loadSettingsFromBackend()
			setSettings(loaded)
			setIsLoading(false)
			initialLoadDone.current = true
		}
		load()
	}, [])

	useEffect(() => {
		if (!initialLoadDone.current) return

		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current)
		}

		saveTimeoutRef.current = setTimeout(() => {
			saveSettingsToBackend(latestSettingsRef.current)
			saveTimeoutRef.current = null
		}, 300)

		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current)
			}
		}
	}, [settings])

	useEffect(function flushSettingsBeforeExit() {
		function flush() {
			if (!initialLoadDone.current) return
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current)
				saveTimeoutRef.current = null
			}
			void saveSettingsToBackend(latestSettingsRef.current)
		}

		window.addEventListener('pagehide', flush)
		window.addEventListener('beforeunload', flush)
		return function cleanup() {
			window.removeEventListener('pagehide', flush)
			window.removeEventListener('beforeunload', flush)
			flush()
		}
	}, [])

	const updateSetting = useCallback(
		<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }))
		},
		[]
	)

	const updateSettings = useCallback((partial: Partial<SettingsState>) => {
		setSettings((prev) => ({ ...prev, ...partial }))
	}, [])

	const resetSettings = useCallback(() => {
		setSettings({ ...DEFAULT_SETTINGS })
	}, [])

	return (
		<SettingsContext.Provider
			value={{
				settings,
				isLoading,
				updateSetting,
				updateSettings,
				resetSettings
			}}
		>
			{children}
		</SettingsContext.Provider>
	)
}

// ============================================================================
// Hooks
// ============================================================================

export function useSettings(): SettingsContextValue {
	const context = useContext(SettingsContext)
	if (!context) {
		throw new Error('useSettings must be used within a SettingsProvider')
	}
	return context
}

export function useSetting<K extends keyof SettingsState>(
	key: K
): [SettingsState[K], (value: SettingsState[K]) => void] {
	const { settings, updateSetting } = useSettings()
	const setValue = useCallback(
		(value: SettingsState[K]) => updateSetting(key, value),
		[key, updateSetting]
	)
	return [settings[key], setValue]
}

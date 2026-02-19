import { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react'
import type { RecordingConfig, RecordingContext as RecordingContextType } from './types'

const DEFAULT_CONFIG: RecordingConfig = {
	hideUiChrome: true,
	hideSidebar: true,
	hideToolbar: false,
	hideStatusBar: true,
	hideDemoBanner: true,
	hideWidget: false,
	focusZoom: 1
}

function getEnvRecordingMode(): boolean {
	if (typeof import.meta !== 'undefined' && import.meta.env) {
		return (
			import.meta.env.VITE_RECORDING_MODE === 'true' ||
			import.meta.env.VITE_RECORDING_MODE === '1'
		)
	}
	return false
}

function getEnvRecordingConfig(): Partial<RecordingConfig> {
	if (typeof import.meta === 'undefined' || !import.meta.env) return {}

	const config: Partial<RecordingConfig> = {}

	if (import.meta.env.VITE_RECORDING_HIDE_SIDEBAR !== undefined) {
		config.hideSidebar = import.meta.env.VITE_RECORDING_HIDE_SIDEBAR === 'true'
	}
	if (import.meta.env.VITE_RECORDING_HIDE_TOOLBAR !== undefined) {
		config.hideToolbar = import.meta.env.VITE_RECORDING_HIDE_TOOLBAR === 'true'
	}
	if (import.meta.env.VITE_RECORDING_HIDE_STATUSBAR !== undefined) {
		config.hideStatusBar = import.meta.env.VITE_RECORDING_HIDE_STATUSBAR === 'true'
	}
	if (import.meta.env.VITE_RECORDING_HIDE_WIDGET !== undefined) {
		config.hideWidget = import.meta.env.VITE_RECORDING_HIDE_WIDGET === 'true'
	}
	if (import.meta.env.VITE_RECORDING_ZOOM !== undefined) {
		config.focusZoom = parseFloat(import.meta.env.VITE_RECORDING_ZOOM) || 1
	}

	return config
}

const RecordingContext = createContext<RecordingContextType | null>(null)

type Props = {
	children: ReactNode
	forceEnabled?: boolean
	initialConfig?: Partial<RecordingConfig>
}

export function RecordingProvider({ children, forceEnabled, initialConfig }: Props) {
	const envEnabled = getEnvRecordingMode()
	const isRecordingMode = forceEnabled ?? envEnabled

	const [config, setConfig] = useState<RecordingConfig>(function initConfig() {
		return {
			...DEFAULT_CONFIG,
			...getEnvRecordingConfig(),
			...initialConfig
		}
	})

	useEffect(
		function applyZoom() {
			if (isRecordingMode && config.focusZoom !== 1) {
				document.documentElement.style.setProperty(
					'--recording-zoom',
					String(config.focusZoom)
				)
				document.body.classList.add('recording-zoom-active')
			} else {
				document.body.classList.remove('recording-zoom-active')
			}
			return function cleanup() {
				document.body.classList.remove('recording-zoom-active')
			}
		},
		[isRecordingMode, config.focusZoom]
	)

	useEffect(
		function applyCustomCss() {
			if (!isRecordingMode || !config.customCss) return

			const styleEl = document.createElement('style')
			styleEl.id = 'recording-custom-css'
			styleEl.textContent = config.customCss
			document.head.appendChild(styleEl)

			return function cleanup() {
				styleEl.remove()
			}
		},
		[isRecordingMode, config.customCss]
	)

	function updateConfig(partial: Partial<RecordingConfig>) {
		setConfig(function merge(prev) {
			return { ...prev, ...partial }
		})
	}

	function shouldHide(element: keyof Omit<RecordingConfig, 'focusZoom' | 'customCss'>): boolean {
		if (!isRecordingMode) return false
		return config[element] === true
	}

	const value = useMemo<RecordingContextType>(
		function createValue() {
			return {
				isRecordingMode,
				config,
				updateConfig,
				shouldHide
			}
		},
		[isRecordingMode, config]
	)

	return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}

export function useRecording(): RecordingContextType {
	const ctx = useContext(RecordingContext)
	if (!ctx) {
		return {
			isRecordingMode: false,
			config: DEFAULT_CONFIG,
			updateConfig: function noop() { },
			shouldHide: function noop() {
				return false
			}
		}
	}
	return ctx
}

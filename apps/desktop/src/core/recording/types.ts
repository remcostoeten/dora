export type RecordingConfig = {
	hideUiChrome: boolean
	hideSidebar: boolean
	hideToolbar: boolean
	hideStatusBar: boolean
	hideDemoBanner: boolean
	hideWidget: boolean
	focusZoom: number
	customCss?: string
}

export type RecordingContext = {
	isRecordingMode: boolean
	config: RecordingConfig
	updateConfig: (partial: Partial<RecordingConfig>) => void
	shouldHide: (element: keyof Omit<RecordingConfig, 'focusZoom' | 'customCss'>) => boolean
}

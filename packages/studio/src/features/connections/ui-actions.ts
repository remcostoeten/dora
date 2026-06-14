import type { SourceCaps } from './source-caps'

/** Attach/import flat files into native DuckDB database connections. */
export const ATTACH_FILE_UI_IMPLEMENTED = true

export type StudioUiAction =
	| 'edit-rows'
	| 'import-csv'
	| 'export-data'
	| 'live-monitor'
	| 'ssh-tunnel'
	| 'local-file'
	| 'remote-url'
	| 'attach-file'

const STUDIO_UI_ACTIONS: StudioUiAction[] = [
	'edit-rows',
	'import-csv',
	'export-data',
	'live-monitor',
	'ssh-tunnel',
	'local-file',
	'remote-url',
	'attach-file',
]

export function isUiActionVisible(action: StudioUiAction, caps: SourceCaps): boolean {
	switch (action) {
		case 'edit-rows':
			return caps.canEditRows
		case 'import-csv':
			return caps.canImportFile
		case 'export-data':
			return caps.canExportFile
		case 'live-monitor':
			return caps.supportsLiveMonitor
		case 'ssh-tunnel':
			return caps.supportsSshTunnel
		case 'local-file':
			return caps.supportsLocalFile
		case 'remote-url':
			return caps.supportsRemoteUrl
		case 'attach-file':
			return ATTACH_FILE_UI_IMPLEMENTED && caps.canAttachFiles
	}
}

export function getVisibleUiActions(caps: SourceCaps): StudioUiAction[] {
	return STUDIO_UI_ACTIONS.filter(function (action) {
		return isUiActionVisible(action, caps)
	})
}

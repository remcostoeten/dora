export type { DbEngine, DbPreset, SourceKind, SourceMeta } from './source-kinds'
export {
	describeConnectionSource,
	resolvePresetToEngine,
	type ConnectionSourceInput,
} from './resolve-source'
export {
	getSourceCaps,
	getSourceCapsForConnection,
	isDataFileSessionConnection,
	isNativeDuckDbFileConnection,
	isReadonlySource,
	type SourceCaps,
} from './source-caps'
export {
	LOCAL_FILE_ERRORS,
	mapImportFilesIntoDuckDbError,
	mapSaveDataFileSessionError,
} from './local-file-errors'
export {
	isUiActionVisible,
	getVisibleUiActions,
	ATTACH_FILE_UI_IMPLEMENTED,
	type StudioUiAction,
} from './ui-actions'
export {
	resolveProviderLabel,
	resolveSourceKindBadge,
	resolveConnectionSubtitle,
	resolveConnectionLocationLabel,
	resolveConnectionSearchText,
	shouldShowSourceKindBadge,
	shouldShowDataFileReadonlyMessage,
	DATA_FILE_READONLY_MESSAGE,
} from './source-labels'
export { SourceBadges } from './components/source-badges'
export { DataFileHealthIndicator } from './components/data-file-health-indicator'
export {
	resolveDataFileHealth,
	formatDataFileSourceSummary,
	shouldShowDataFileHelpPanel,
	isDataFileConnection,
	resolveDataFileConnectionSummary,
	dataFileHealthLabel,
	DATA_FILE_HELP_ITEMS,
	SAVE_AS_DUCKDB_PLACEHOLDER_LABEL,
	SAVE_AS_DUCKDB_PLACEHOLDER_HINT,
	type DataFileHealth,
} from './data-file-health'
export {
	resolveSourceDebugInfo,
	logSourceDebugInfo,
	type SourceDebugInfo,
} from './source-debug'

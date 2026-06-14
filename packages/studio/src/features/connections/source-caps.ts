import type { Connection } from './types'
import type { DbEngine, SourceMeta } from './source-kinds'
import { describeConnectionSource, type ConnectionSourceInput } from './resolve-source'

export type SourceCaps = {
	canRunSql: boolean
	canInspectSchema: boolean
	canEditRows: boolean
	canImportFile: boolean
	canExportFile: boolean
	canQueryFiles: boolean
	canAttachFiles: boolean
	supportsLocalFile: boolean
	supportsRemoteUrl: boolean
	supportsSshTunnel: boolean
	supportsLiveMonitor: boolean
	isReadonly: boolean
}

const ENGINE_CAPS: Record<DbEngine, SourceCaps> = {
	postgres: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: true,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: false,
		supportsRemoteUrl: true,
		supportsSshTunnel: true,
		supportsLiveMonitor: true,
		isReadonly: false,
	},
	cockroach: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: true,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: false,
		supportsRemoteUrl: true,
		supportsSshTunnel: true,
		supportsLiveMonitor: true,
		isReadonly: false,
	},
	mysql: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: true,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: false,
		supportsRemoteUrl: true,
		supportsSshTunnel: true,
		supportsLiveMonitor: true,
		isReadonly: false,
	},
	mariadb: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: true,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: false,
		supportsRemoteUrl: true,
		supportsSshTunnel: true,
		supportsLiveMonitor: true,
		isReadonly: false,
	},
	sqlite: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: true,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: true,
		supportsRemoteUrl: false,
		supportsSshTunnel: false,
		supportsLiveMonitor: true,
		isReadonly: false,
	},
	duckdb: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: false,
		canExportFile: true,
		canQueryFiles: true,
		canAttachFiles: true,
		supportsLocalFile: true,
		supportsRemoteUrl: false,
		supportsSshTunnel: false,
		supportsLiveMonitor: false,
		isReadonly: false,
	},
	libsql: {
		canRunSql: true,
		canInspectSchema: true,
		canEditRows: true,
		canImportFile: false,
		canExportFile: true,
		canQueryFiles: false,
		canAttachFiles: false,
		supportsLocalFile: true,
		supportsRemoteUrl: true,
		supportsSshTunnel: false,
		supportsLiveMonitor: false,
		isReadonly: false,
	},
}

function applyDataFileSessionOverrides(caps: SourceCaps): SourceCaps {
	return {
		...caps,
		canEditRows: false,
		canImportFile: false,
		canAttachFiles: false,
		supportsLiveMonitor: false,
		isReadonly: true,
	}
}

export function getSourceCaps(
	connection: ConnectionSourceInput,
	meta: SourceMeta = describeConnectionSource(connection)
): SourceCaps {
	const caps = ENGINE_CAPS[meta.engine]

	if (meta.isDataFileSession) {
		return applyDataFileSessionOverrides(caps)
	}

	return caps
}

export function getSourceCapsForConnection(connection: Connection): SourceCaps {
	return getSourceCaps(connection)
}

export function isReadonlySource(connection: ConnectionSourceInput): boolean {
	return getSourceCaps(connection).isReadonly
}

export function isDataFileSessionConnection(connection: ConnectionSourceInput): boolean {
	return describeConnectionSource(connection).isDataFileSession
}

/** Native on-disk DuckDB file (editable, can import files). Not a readonly data-file session. */
export function isNativeDuckDbFileConnection(connection: ConnectionSourceInput): boolean {
	const caps = getSourceCaps(connection)
	return caps.canAttachFiles && !caps.isReadonly
}
